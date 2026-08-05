// ============================================
// server.js - Hayyo Exam Backend
// ============================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dns = require('dns');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// FORCE IPv4 (Fixes Supabase connection)
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 1. DATABASE CONNECTION (FIXED - IPv4)
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

// ============================================
// 2. CLOUDINARY SETUP
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'payment_receipts',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF allowed.'), false);
    }
  }
});

// ============================================
// 3. MIDDLEWARE
// ============================================
app.enable('trust proxy');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================
// 4. RATE LIMITING
// ============================================
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/api/', limiter);
app.use('/api/payment/', strictLimiter);
app.use('/api/admin/', strictLimiter);

// ============================================
// 5. SESSION STORE (PostgreSQL)
// ============================================
app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ============================================
// 6. PASSPORT (Google OAuth)
// ============================================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [profile.id]);
    if (result.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (id, email, name, avatar_url) VALUES ($1, $2, $3, $4)',
        [profile.id, profile.emails[0].value, profile.displayName, profile.photos?.[0]?.value]
      );
    }
    return done(null, { id: profile.id, email: profile.emails[0].value, name: profile.displayName });
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ============================================
// 7. JWT HELPERS
// ============================================
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function isAuthenticated(req, res, next) {
  await verifyToken(req, res, async () => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.userData = result.rows[0];
    next();
  });
}

async function isAdmin(req, res, next) {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  if (!adminEmails.includes(req.userData.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function isTeacher(req, res, next) {
  if (!req.userData.is_teacher) {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
}

async function checkPremium(req, res, next) {
  const result = await pool.query('SELECT is_premium, premium_expires_at FROM users WHERE id = $1', [req.user.userId]);
  const user = result.rows[0];
  const isPremium = user?.is_premium && (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
  if (!isPremium) {
    return res.status(403).json({ error: 'Premium access required', payment_required: true });
  }
  req.isPremium = true;
  next();
}

// ============================================
// 8. ROUTES
// ============================================

// --- AUTH ROUTES ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  const token = generateToken(req.user);
  res.redirect(`${process.env.FRONTEND_URL}/dashboard.html?token=${token}`);
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});

app.get('/api/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, is_premium FROM users WHERE id = $1', [req.user.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ authenticated: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EXAM ROUTES ---
app.get('/api/exams', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exams ORDER BY year DESC, title ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exams/:id', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM exams WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exams/:id/access', isAuthenticated, async (req, res) => {
  try {
    const examResult = await pool.query('SELECT is_premium_only FROM exams WHERE id = $1', [req.params.id]);
    if (examResult.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const exam = examResult.rows[0];
    if (!exam.is_premium_only) {
      return res.json({ can_access: true, is_free: true, message: 'Free exam - access granted' });
    }
    const userResult = await pool.query('SELECT is_premium, premium_expires_at FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];
    const isPremium = user?.is_premium && (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
    res.json({
      can_access: isPremium,
      is_premium_only: true,
      is_premium: isPremium,
      message: isPremium ? 'Premium access granted' : 'Premium access required'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exams/:id/questions', isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, question_number, text, options FROM questions WHERE exam_id = $1 ORDER BY question_number ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/exams/start', isAuthenticated, async (req, res) => {
  const { exam_id, password } = req.body;
  if (password !== process.env.EXAM_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  try {
    const existing = await pool.query(
      'SELECT * FROM exam_attempts WHERE user_id = $1 AND exam_id = $2 AND status = $3',
      [req.user.userId, exam_id, 'in-progress']
    );
    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        attempt_id: existing.rows[0].id,
        current_question: existing.rows[0].current_question,
        time_remaining: existing.rows[0].time_remaining,
        answers: existing.rows[0].answers
      });
    }
    const examResult = await pool.query('SELECT time_limit, total_questions FROM exams WHERE id = $1', [exam_id]);
    if (examResult.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const exam = examResult.rows[0];
    const result = await pool.query(
      'INSERT INTO exam_attempts (user_id, exam_id, time_remaining, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.userId, exam_id, exam.time_limit * 60, 'in-progress']
    );
    const questionsResult = await pool.query(
      'SELECT id, question_number, text, options FROM questions WHERE exam_id = $1 ORDER BY RANDOM()',
      [exam_id]
    );
    res.json({
      success: true,
      attempt_id: result.rows[0].id,
      current_question: 1,
      time_remaining: exam.time_limit * 60,
      total_questions: exam.total_questions,
      questions: questionsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/exams/submit', isAuthenticated, async (req, res) => {
  const { attempt_id, answers } = req.body;
  try {
    const attemptResult = await pool.query('SELECT exam_id FROM exam_attempts WHERE id = $1 AND user_id = $2', [attempt_id, req.user.userId]);
    if (attemptResult.rows.length === 0) return res.status(404).json({ error: 'Attempt not found' });
    const exam_id = attemptResult.rows[0].exam_id;
    const questionsResult = await pool.query('SELECT question_number, correct_answer FROM questions WHERE exam_id = $1', [exam_id]);
    let correct = 0;
    const total = questionsResult.rows.length;
    const results = [];
    questionsResult.rows.forEach(q => {
      const userAnswer = answers[q.question_number];
      const isCorrect = userAnswer === q.correct_answer;
      if (isCorrect) correct++;
      results.push({ question: q.question_number, user_answer: userAnswer, correct_answer: q.correct_answer, is_correct: isCorrect });
    });
    const percentage = Math.round((correct / total) * 100);
    await pool.query(
      'UPDATE exam_attempts SET status = $1, score = $2, percentage = $3, answers = $4, submitted_at = NOW() WHERE id = $5',
      ['submitted', correct, percentage, JSON.stringify(answers), attempt_id]
    );
    res.json({ success: true, score: correct, total: total, percentage: percentage, results: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PAYMENT ROUTES ---
app.post('/api/payment/request', isAuthenticated, async (req, res) => {
  const { exam_id, payment_method, reference_number } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO payments (user_id, exam_id, payment_method, reference_number, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.userId, exam_id, payment_method, reference_number, 'pending']
    );
    res.json({ success: true, payment_id: result.rows[0].id, message: 'Payment request submitted. Awaiting approval.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment/upload', isAuthenticated, upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await pool.query(
      'UPDATE payments SET receipt_url = $1, receipt_filename = $2 WHERE user_id = $3 AND status = $4 ORDER BY created_at DESC LIMIT 1 RETURNING id',
      [req.file.path, req.file.originalname, req.user.userId, 'pending']
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No pending payment found' });
    res.json({ success: true, receipt_url: req.file.path, message: 'Receipt uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payment/status', isAuthenticated, async (req, res) => {
  try {
    const payments = await pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC', [req.user.userId]);
    const user = await pool.query('SELECT is_premium, premium_expires_at FROM users WHERE id = $1', [req.user.userId]);
    res.json({ payments: payments.rows, is_premium: user.rows[0]?.is_premium || false, premium_expires_at: user.rows[0]?.premium_expires_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/payments', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.*, u.name, u.email FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/payments/:id/approve', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const paymentResult = await pool.query('SELECT user_id FROM payments WHERE id = $1 AND status = $2', [id, 'pending']);
    if (paymentResult.rows.length === 0) return res.status(404).json({ error: 'Payment not found or already processed' });
    const userId = paymentResult.rows[0].user_id;
    await pool.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', ['approved', id]);
    await pool.query('UPDATE users SET is_premium = TRUE, premium_expires_at = NOW() + INTERVAL $1 WHERE id = $2', ['1 year', userId]);
    res.json({ success: true, message: 'Payment approved and premium access granted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/payments/:id/reject', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await pool.query('UPDATE payments SET status = $1, admin_notes = $2, updated_at = NOW() WHERE id = $3', ['rejected', reason || 'Payment rejected by admin', id]);
    res.json({ success: true, message: 'Payment rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/payments/:id/receipt', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT receipt_url FROM payments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0 || !result.rows[0].receipt_url) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json({ receipt_url: result.rows[0].receipt_url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TEACHER ROUTES ---
app.get('/api/teacher/exams', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT e.* FROM exams e JOIN teacher_exams te ON e.id = te.exam_id WHERE te.teacher_id = $1',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teacher/exams/:id', isAuthenticated, isTeacher, async (req, res) => {
  const { id } = req.params;
  const { title, subject, year, type, category, is_premium_only, time_limit, total_questions } = req.body;
  try {
    const check = await pool.query('SELECT * FROM teacher_exams WHERE teacher_id = $1 AND exam_id = $2', [req.user.userId, id]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'You are not assigned to this exam' });
    await pool.query(
      'UPDATE exams SET title = $1, subject = $2, year = $3, type = $4, category = $5, is_premium_only = $6, time_limit = $7, total_questions = $8 WHERE id = $9',
      [title, subject, year, type, category, is_premium_only, time_limit, total_questions, id]
    );
    res.json({ success: true, message: 'Exam updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teacher/exams/:id/questions/:num', isAuthenticated, isTeacher, async (req, res) => {
  const { id, num } = req.params;
  const { text, option_a, option_b, option_c, option_d, correct_answer, explanation } = req.body;
  try {
    const check = await pool.query('SELECT * FROM teacher_exams WHERE teacher_id = $1 AND exam_id = $2', [req.user.userId, id]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'You are not assigned to this exam' });
    await pool.query(
      'UPDATE questions SET text = $1, options = $2, correct_answer = $3, explanation = $4 WHERE exam_id = $5 AND question_number = $6',
      [text, JSON.stringify([option_a, option_b, option_c, option_d]), correct_answer, explanation, id, num]
    );
    res.json({ success: true, message: 'Question updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 9. HEALTH CHECK
// ============================================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(500).json({ status: 'error', timestamp: new Date().toISOString(), database: 'disconnected', error: error.message });
  }
});

// ============================================
// 10. KEEP-ALIVE (For Supabase)
// ============================================
app.get('/api/keep-alive', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 11. ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ============================================
// 12. START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Hayyo Academy backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});
