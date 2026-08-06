// ============================================
// server.js - Hayyo Exam Backend (Supabase REST API)
// ============================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ============================================
// SUPABASE REST API CLIENT
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Helper function for Supabase REST API calls
async function supabaseFetch(endpoint, options = {}) {
  const url = SUPABASE_URL + '/rest/v1' + endpoint;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  if (options.admin) {
    headers['Authorization'] = 'Bearer ' + SUPABASE_SERVICE_KEY;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Supabase API error: ' + response.status + ' - ' + error);
  }

  return response.json();
}

// Helper for SELECT queries with better error handling
async function supabaseSelect(table, params = {}) {
  let url = '/' + table;
  const queryParams = new URLSearchParams();

  if (params.select) queryParams.append('select', params.select);
  if (params.eq) {
    const eqKeys = Object.keys(params.eq);
    if (eqKeys.length === 0) {
      throw new Error('Empty eq filter provided');
    }
    
    for (const key of eqKeys) {
      const value = params.eq[key];
      if (value === undefined || value === null || value === '') {
        throw new Error('Empty value for filter key: ' + key);
      }
      queryParams.append(key + '=eq.' + encodeURIComponent(value), '');
    }
  }
  if (params.order) queryParams.append('order', params.order.column + '.' + (params.order.direction || 'asc'));
  if (params.limit) queryParams.append('limit', params.limit);

  const queryString = queryParams.toString();
  if (queryString) url += '?' + queryString;

  return supabaseFetch(url);
}

// Helper for INSERT
async function supabaseInsert(table, data) {
  return supabaseFetch('/' + table, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// Helper for UPDATE
async function supabaseUpdate(table, data, eq) {
  const keys = Object.keys(eq);
  const key = keys[0];
  const value = eq[key];
  return supabaseFetch('/' + table + '?' + key + '=eq.' + value, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

// Helper for DELETE
async function supabaseDelete(table, eq) {
  const keys = Object.keys(eq);
  const key = keys[0];
  const value = eq[key];
  return supabaseFetch('/' + table + '?' + key + '=eq.' + value, {
    method: 'DELETE'
  });
}

// ============================================
// DIRECT SUPABASE HELPERS FOR OAUTH (WITH DEBUG LOGGING)
// ============================================
async function findUserByEmail(email) {
  console.log('🔍 findUserByEmail called with:', email);
  const url = SUPABASE_URL + '/rest/v1/users?select=*&email=eq.' + encodeURIComponent(email);
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log('🔍 findUserByEmail response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ findUserByEmail error:', errorText);
      return null;
    }
    const data = await response.json();
    console.log('🔍 findUserByEmail data:', data);
    return data && data[0] ? data[0] : null;
  } catch (error) {
    console.error('❌ findUserByEmail exception:', error.message);
    return null;
  }
}

async function findUserById(id) {
  console.log('🔍 findUserById called with:', id);
  const url = SUPABASE_URL + '/rest/v1/users?select=*&id=eq.' + encodeURIComponent(id);
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log('🔍 findUserById response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ findUserById error:', errorText);
      return null;
    }
    const data = await response.json();
    console.log('🔍 findUserById data:', data);
    return data && data[0] ? data[0] : null;
  } catch (error) {
    console.error('❌ findUserById exception:', error.message);
    return null;
  }
}

async function createUser(userData) {
  console.log('🔍 createUser called with email:', userData.email);
  console.log('📝 Full user data:', JSON.stringify(userData, null, 2));
  
  const url = SUPABASE_URL + '/rest/v1/users';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(userData)
    });
    
    console.log('🔍 createUser response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ createUser error response:', errorText);
      return null;
    }
    
    const data = await response.json();
    console.log('✅ createUser success, data:', data);
    return data && data[0] ? data[0] : null;
  } catch (error) {
    console.error('❌ createUser exception:', error.message);
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CLOUDINARY SETUP
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
// MIDDLEWARE
// ============================================
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
      frameSrc: ["'self'", "https://*.supabase.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ============================================
// CORS - Allow multiple origins (FIXED)
// ============================================
const allowedOrigins = [
  'https://Shime1000me.github.io',
  'https://Shime1000me.github.io/hayyo-exam',
  'https://hayyo-exam.onrender.com',
  'http://localhost:8000',
  'http://localhost:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================
// RATE LIMITING
// ============================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req) => {
    return req.path === '/health' || req.path === '/api/keep-alive';
  }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

app.use('/api/', limiter);
app.use('/api/payment/', strictLimiter);
app.use('/api/admin/', strictLimiter);

// ============================================
// SESSION STORE - Memory Store (No Database)
// ============================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ============================================
// PASSPORT (Google OAuth) - WITH DEBUG LOGGING
// ============================================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: (process.env.BACKEND_URL || 'https://hayyo-exam.onrender.com') + '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('========================================');
    console.log('📱 Google profile received:');
    console.log('🆔 ID:', profile.id);
    console.log('👤 Name:', profile.displayName);
    console.log('📧 Email:', profile.emails && profile.emails[0] ? profile.emails[0].value : 'No email');
    console.log('========================================');
    
    if (!profile || !profile.id) {
      throw new Error('Invalid profile data from Google - no ID');
    }

    // Step 1: Try to find user by Google ID
    console.log('🔍 Step 1: Searching for user by ID...');
    let user = await findUserById(profile.id);
    
    // Step 2: If not found, try by email
    if (!user) {
      console.log('🔍 Step 2: User not found by ID, searching by email...');
      const email = (profile.emails && profile.emails[0]) ? profile.emails[0].value : null;
      if (email) {
        console.log('📧 Looking for user by email:', email);
        user = await findUserByEmail(email);
      } else {
        console.log('⚠️ No email found in profile');
      }
    }

    // Step 3: If still not found, create a new user
    if (!user) {
      console.log('🔍 Step 3: User not found, creating new user...');
      const newUser = {
        id: profile.id,
        email: (profile.emails && profile.emails[0]) ? profile.emails[0].value : 'unknown@email.com',
        name: profile.displayName || 'Unknown User',
        avatar_url: (profile.photos && profile.photos[0]) ? profile.photos[0].value : null,
        is_teacher: false,
        is_premium: false,
        created_at: new Date().toISOString()
      };
      
      console.log('📝 New user data:', JSON.stringify(newUser, null, 2));
      
      user = await createUser(newUser);
      
      if (user) {
        console.log('✅ User created successfully!');
      } else {
        console.log('❌ User creation returned null, trying one more lookup...');
        user = await findUserById(profile.id);
        if (user) {
          console.log('✅ Found user after retry!');
        } else {
          console.log('❌ Still no user found after retry');
        }
      }
    } else {
      console.log('✅ User found in database:', user.email);
    }

    if (!user) {
      console.log('❌ FATAL: Could not find or create user');
      throw new Error('Could not find or create user');
    }

    console.log('✅ Authentication successful!');
    console.log('👤 User:', user.email, user.id);
    console.log('========================================');
    
    return done(null, { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      is_teacher: user.is_teacher || false,
      is_premium: user.is_premium || false
    });
    
  } catch (error) {
    console.error('❌ Google Strategy Error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return done(error);
  }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ============================================
// JWT HELPERS
// ============================================
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    const users = await supabaseSelect('users', {
      eq: { id: decoded.userId },
      select: '*'
    });
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.userData = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function isAdmin(req, res, next) {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
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

// ============================================
// ROUTES
// ============================================

// --- AUTH ROUTES ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// ============================================
// FIXED: OAuth Callback - Redirects to REAL Dashboard
// ============================================
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  const token = generateToken(req.user);
  // Redirect to the REAL dashboard (not test-dashboard)
  const redirectUrl = 'https://Shime1000me.github.io/hayyo-exam/dashboard.html?token=' + token;
  console.log('🔍 OAuth Success - Redirecting to:', redirectUrl);
  res.redirect(redirectUrl);
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});

// ============================================
// FIXED: /api/me - Uses DIRECT fetch to Supabase
// ============================================
app.get('/api/me', verifyToken, async (req, res) => {
  try {
    console.log('🔍 /api/me called for user:', req.user.userId);
    
    // DIRECT fetch to Supabase - bypasses supabaseSelect helper
    const url = SUPABASE_URL + '/rest/v1/users?select=*&id=eq.' + encodeURIComponent(req.user.userId);
    console.log('🔍 /api/me: Fetching from:', url);
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 /api/me: Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ /api/me: Supabase error:', response.status, errorText);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const users = await response.json();
    console.log('🔍 /api/me: Supabase response:', users);
    
    if (!users || users.length === 0) {
      console.log('❌ /api/me: User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ /api/me: User found:', users[0].email);
    res.json({ authenticated: true, user: users[0] });
    
  } catch (error) {
    console.error('❌ /api/me error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- ROOT ROUTE ---
app.get('/', (req, res) => {
  res.json({
    name: 'Hayyo Exam API',
    version: '1.0.0',
    status: 'running',
    documentation: 'https://hayyo-exam.onrender.com/api-docs',
    endpoints: {
      auth: '/auth/google',
      exams: '/api/exams',
      payment: '/api/payment',
      admin: '/api/admin',
      teacher: '/api/teacher',
      health: '/health'
    }
  });
});

// --- EXAM ROUTES ---
app.get('/api/exams', isAuthenticated, async (req, res) => {
  try {
    const exams = await supabaseSelect('exams', {
      order: { column: 'year', direction: 'desc' }
    });
    res.json({ success: true, exams: exams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exams/:id', isAuthenticated, async (req, res) => {
  try {
    const exams = await supabaseSelect('exams', {
      eq: { id: req.params.id },
      select: '*'
    });
    if (exams.length === 0) return res.status(404).json({ error: 'Exam not found' });
    res.json({ success: true, exam: exams[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/exams/:id/access', isAuthenticated, async (req, res) => {
  try {
    const exams = await supabaseSelect('exams', {
      eq: { id: req.params.id },
      select: 'is_premium_only, title'
    });
    if (exams.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const exam = exams[0];
    if (!exam.is_premium_only) {
      return res.json({ can_access: true, is_free: true, message: 'Free exam - access granted' });
    }
    const isPremium = req.userData?.is_premium && (!req.userData.premium_expires_at || new Date(req.userData.premium_expires_at) > new Date());
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
    const questions = await supabaseSelect('questions', {
      eq: { exam_id: req.params.id },
      order: { column: 'question_number' },
      select: 'id, question_number, text, options'
    });
    res.json({ success: true, questions: questions });
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
    const existing = await supabaseSelect('exam_attempts', {
      eq: { user_id: req.user.userId, exam_id: exam_id },
      select: '*'
    });
    const inProgress = existing.find(a => a.status === 'in-progress');
    if (inProgress) {
      return res.json({
        success: true,
        attempt_id: inProgress.id,
        current_question: inProgress.current_question,
        time_remaining: inProgress.time_remaining,
        answers: inProgress.answers
      });
    }
    const exams = await supabaseSelect('exams', {
      eq: { id: exam_id },
      select: 'time_limit, total_questions'
    });
    if (exams.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const exam = exams[0];
    const newAttempt = await supabaseInsert('exam_attempts', {
      user_id: req.user.userId,
      exam_id: exam_id,
      time_remaining: exam.time_limit * 60,
      status: 'in-progress',
      started_at: new Date().toISOString()
    });
    const questions = await supabaseSelect('questions', {
      eq: { exam_id: exam_id },
      order: { column: 'question_number' },
      select: 'id, question_number, text, options'
    });
    res.json({
      success: true,
      attempt_id: newAttempt[0]?.id,
      current_question: 1,
      time_remaining: exam.time_limit * 60,
      total_questions: exam.total_questions,
      questions: questions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/exams/submit', isAuthenticated, async (req, res) => {
  const { attempt_id, answers } = req.body;
  try {
    const attempts = await supabaseSelect('exam_attempts', {
      eq: { id: attempt_id, user_id: req.user.userId },
      select: 'exam_id'
    });
    if (attempts.length === 0) return res.status(404).json({ error: 'Attempt not found' });
    const exam_id = attempts[0].exam_id;
    const questions = await supabaseSelect('questions', {
      eq: { exam_id: exam_id },
      select: 'question_number, correct_answer'
    });
    let correct = 0;
    const total = questions.length;
    const results = [];
    questions.forEach(q => {
      const userAnswer = answers[q.question_number];
      const isCorrect = userAnswer === q.correct_answer;
      if (isCorrect) correct++;
      results.push({ question: q.question_number, user_answer: userAnswer, correct_answer: q.correct_answer, is_correct: isCorrect });
    });
    const percentage = Math.round((correct / total) * 100);
    await supabaseUpdate('exam_attempts', {
      status: 'submitted',
      score: correct,
      percentage: percentage,
      answers: JSON.stringify(answers),
      submitted_at: new Date().toISOString()
    }, { id: attempt_id });
    res.json({ success: true, score: correct, total: total, percentage: percentage, results: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GET EXAM RESULTS ---
app.get('/api/exams/:exam_id/results/:user_id', async (req, res) => {
  try {
    const { exam_id, user_id } = req.params;
    const attempts = await supabaseSelect('exam_attempts', {
      eq: { exam_id: exam_id, user_id: user_id, status: 'submitted' },
      order: { column: 'submitted_at', direction: 'desc' },
      limit: 1
    });
    if (attempts.length === 0) {
      return res.status(404).json({ error: 'Results not found' });
    }
    const attempt = attempts[0];
    const user = await supabaseSelect('users', {
      eq: { id: user_id },
      select: 'name, email'
    });
    const exam = await supabaseSelect('exams', {
      eq: { id: exam_id },
      select: 'title, total_questions'
    });
    res.json({
      success: true,
      results: {
        ...attempt,
        user_name: user[0]?.name || 'Unknown',
        exam_title: exam[0]?.title || 'Unknown Exam',
        total_questions: exam[0]?.total_questions || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PAYMENT ROUTES ---
app.post('/api/payment/request', isAuthenticated, async (req, res) => {
  const { exam_id, payment_method, reference_number } = req.body;
  try {
    const result = await supabaseInsert('payments', {
      user_id: req.user.userId,
      exam_id: exam_id,
      payment_method: payment_method,
      reference_number: reference_number,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    res.json({ success: true, payment_id: result[0]?.id, message: 'Payment request submitted. Awaiting approval.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment/upload', isAuthenticated, upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const payments = await supabaseSelect('payments', {
      eq: { user_id: req.user.userId, status: 'pending' },
      order: { column: 'created_at', direction: 'desc' },
      limit: 1
    });
    if (payments.length === 0) return res.status(404).json({ error: 'No pending payment found' });
    await supabaseUpdate('payments', {
      receipt_url: req.file.path,
      receipt_filename: req.file.originalname,
      updated_at: new Date().toISOString()
    }, { id: payments[0].id });
    res.json({ success: true, receipt_url: req.file.path, message: 'Receipt uploaded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payment/status', isAuthenticated, async (req, res) => {
  try {
    const payments = await supabaseSelect('payments', {
      eq: { user_id: req.user.userId },
      order: { column: 'created_at', direction: 'desc' }
    });
    res.json({
      success: true,
      payments: payments,
      is_premium: req.userData?.is_premium || false,
      premium_expires_at: req.userData?.premium_expires_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/admin/payments', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const payments = await supabaseSelect('payments', {
      order: { column: 'created_at', direction: 'desc' }
    });
    const paymentsWithUsers = await Promise.all(payments.map(async (p) => {
      const users = await supabaseSelect('users', {
        eq: { id: p.user_id },
        select: 'name, email'
      });
      const exams = await supabaseSelect('exams', {
        eq: { id: p.exam_id },
        select: 'title'
      });
      return { 
        ...p, 
        student_name: users[0]?.name || 'Unknown',
        student_email: users[0]?.email || 'Unknown',
        exam_title: exams[0]?.title || 'Unknown Exam'
      };
    }));
    res.json({ success: true, payments: paymentsWithUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/payments/:id/approve', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const payments = await supabaseSelect('payments', {
      eq: { id: id, status: 'pending' },
      select: 'user_id'
    });
    if (payments.length === 0) return res.status(404).json({ error: 'Payment not found or already processed' });
    const userId = payments[0].user_id;
    await supabaseUpdate('payments', {
      status: 'approved',
      updated_at: new Date().toISOString()
    }, { id: id });
    await supabaseUpdate('users', {
      is_premium: true,
      premium_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }, { id: userId });
    res.json({ success: true, message: 'Payment approved and premium access granted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/payments/:id/reject', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await supabaseUpdate('payments', {
      status: 'rejected',
      admin_notes: reason || 'Payment rejected by admin',
      updated_at: new Date().toISOString()
    }, { id: id });
    res.json({ success: true, message: 'Payment rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/payments/:id/receipt', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const payments = await supabaseSelect('payments', {
      eq: { id: req.params.id },
      select: 'receipt_url'
    });
    if (payments.length === 0 || !payments[0].receipt_url) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json({ success: true, receipt_url: payments[0].receipt_url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TEACHER ROUTES ---
app.get('/api/teacher/exams', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const teacherExams = await supabaseSelect('teacher_exams', {
      eq: { teacher_id: req.user.userId },
      select: 'exam_id'
    });
    const examIds = teacherExams.map(te => te.exam_id);
    if (examIds.length === 0) {
      return res.json({ success: true, exams: [] });
    }
    const exams = await supabaseSelect('exams', {
      select: '*'
    });
    const filtered = exams.filter(e => examIds.includes(e.id));
    res.json({ success: true, exams: filtered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teacher/exams/:id', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const teacherExams = await supabaseSelect('teacher_exams', {
      eq: { teacher_id: req.user.userId, exam_id: id },
      select: '*'
    });
    if (teacherExams.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this exam' });
    }
    const exams = await supabaseSelect('exams', {
      eq: { id: id },
      select: '*'
    });
    if (exams.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const questions = await supabaseSelect('questions', {
      eq: { exam_id: id },
      order: { column: 'question_number' },
      select: '*'
    });
    res.json({ 
      success: true, 
      exam: exams[0],
      questions: questions 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teacher/exams/:id', isAuthenticated, isTeacher, async (req, res) => {
  const { id } = req.params;
  const { title, subject, year, type, category, is_premium_only, time_limit, total_questions, description } = req.body;
  try {
    const teacherExams = await supabaseSelect('teacher_exams', {
      eq: { teacher_id: req.user.userId, exam_id: id },
      select: '*'
    });
    if (teacherExams.length === 0) return res.status(403).json({ error: 'You are not assigned to this exam' });
    await supabaseUpdate('exams', {
      title, subject, year, type, category, is_premium_only, time_limit, total_questions, description,
      updated_at: new Date().toISOString()
    }, { id: id });
    res.json({ success: true, message: 'Exam updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teacher/exams/:id/questions/:num', isAuthenticated, isTeacher, async (req, res) => {
  const { id, num } = req.params;
  const { text, option_a, option_b, option_c, option_d, correct_answer, explanation } = req.body;
  try {
    const teacherExams = await supabaseSelect('teacher_exams', {
      eq: { teacher_id: req.user.userId, exam_id: id },
      select: '*'
    });
    if (teacherExams.length === 0) return res.status(403).json({ error: 'You are not assigned to this exam' });
    await supabaseUpdate('questions', {
      text: text,
      options: JSON.stringify([option_a, option_b, option_c, option_d]),
      correct_answer: correct_answer,
      explanation: explanation,
      updated_at: new Date().toISOString()
    }, { exam_id: id, question_number: num });
    res.json({ success: true, message: 'Question updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BULK INSERT QUESTIONS ---
app.post('/api/teacher/exams/:id/questions/bulk', isAuthenticated, isTeacher, async (req, res) => {
  const { id } = req.params;
  const { questions } = req.body;
  try {
    const teacherExams = await supabaseSelect('teacher_exams', {
      eq: { teacher_id: req.user.userId, exam_id: id },
      select: '*'
    });
    if (teacherExams.length === 0) return res.status(403).json({ error: 'You are not assigned to this exam' });
    
    // Delete existing questions
    await supabaseDelete('questions', { exam_id: id });
    
    // Insert new questions
    const inserted = [];
    for (const q of questions) {
      const result = await supabaseInsert('questions', {
        exam_id: id,
        question_number: q.question_number,
        text: q.text,
        options: q.options ? JSON.stringify(q.options) : null,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        marks: q.marks || 1
      });
      inserted.push(result[0]);
    }
    res.json({ success: true, message: inserted.length + ' questions imported successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', async (req, res) => {
  try {
    await supabaseSelect('users', { limit: 1 });
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(), 
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(500).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(), 
      database: 'disconnected', 
      error: error.message 
    });
  }
});

// ============================================
// KEEP-ALIVE
// ============================================
app.get('/api/keep-alive', async (req, res) => {
  try {
    await supabaseSelect('users', { limit: 1 });
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error',
    path: req.path,
    method: req.method
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('🚀 Hayyo Academy backend running on port ' + PORT);
  console.log('📊 Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('🔗 Supabase API: ' + SUPABASE_URL);
  console.log('🌐 Trust proxy: ' + app.get('trust proxy'));
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  process.exit(0);
});
