<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAEAEBAQAAEABAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAA////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
    <title>Hayyo Academy - Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@100..900&family=Inter:opsz@14..32&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Raleway', 'Inter', sans-serif;
            background: #f8fafc;
        }
        .app-header {
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            height: 48px;
            padding: 0 1rem;
            gap: 0.5rem;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .app-header .logo {
            font-size: 1.25rem;
            font-weight: 700;
            color: #2563eb;
            margin-right: 1rem;
        }
        .app-header nav {
            display: flex;
            align-items: stretch;
            height: 100%;
        }
        .app-header nav a {
            display: flex;
            align-items: center;
            padding: 0 0.75rem;
            font-size: 0.875rem;
            border-bottom: 2px solid transparent;
            text-decoration: none;
            color: #64748b;
            cursor: pointer;
        }
        .app-header nav a:hover {
            color: #0f172a;
        }
        .app-header nav a.active {
            border-bottom-color: #2563eb;
            color: #2563eb;
            font-weight: 500;
        }
        .app-header nav a.logout-btn {
            color: #dc2626;
            border-bottom-color: transparent;
        }
        .app-header nav a.logout-btn:hover {
            color: #b91c1c;
        }
        .app-header .user-menu {
            margin-left: auto;
            display: flex;
            align-items: center;
        }
        .app-header .user-menu .avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #2563eb;
            color: white;
            font-size: 0.65rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            text-transform: uppercase;
        }
        .red-line {
            height: 2px;
            background: #dc2626;
        }
        .main-content {
            flex: 1;
            min-width: 0;
            padding: 1rem 1.5rem;
            max-width: 80rem;
            margin: 0 auto;
            width: 100%;
        }
        .info-box {
            border: 1px solid #e2e8f0;
            font-size: 0.875rem;
            width: 100%;
        }
        .info-box .info-header {
            background: #f1f5f9;
            padding: 0.375rem 1rem;
            font-weight: 600;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
        }
        .info-box .info-row {
            display: grid;
            grid-template-columns: 160px 1fr 160px 1fr;
            gap: 1.5rem;
            padding: 0.5rem 1rem;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
        }
        .info-box .info-row:last-child {
            border-bottom: none;
        }
        .info-box .info-row .label {
            font-weight: 600;
            color: #0f172a;
            white-space: nowrap;
        }
        .info-box .info-row .value {
            font-weight: 600;
            color: #0f172a;
        }
        .welcome-section {
            margin-top: 2.5rem;
        }
        .welcome-section h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.125rem;
            color: #0f172a;
        }
        .welcome-section h2 {
            font-size: 1rem;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 1rem;
        }
        .search-bar {
            position: relative;
            width: 12rem;
            margin-bottom: 1.25rem;
        }
        .search-bar input {
            width: 100%;
            border: none;
            border-bottom: 1px solid #e2e8f0;
            background: transparent;
            padding: 0.25rem 0 0.25rem 2rem;
            height: 2.25rem;
            font-size: 0.875rem;
            border-radius: 0;
            font-family: 'Inter', sans-serif;
            color: #0f172a;
        }
        .search-bar input:focus {
            outline: none;
            border-bottom-color: #2563eb;
        }
        .search-bar .icon {
            position: absolute;
            left: 0.5rem;
            top: 50%;
            transform: translateY(-50%);
            color: #9ca3af;
        }
        .exam-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }
        @media (min-width: 640px) {
            .exam-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        @media (min-width: 768px) {
            .exam-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }
        .exam-card {
            border: 1px solid #e2e8f0;
            border-radius: 0.125rem;
            overflow: hidden;
            cursor: pointer;
            background: #ffffff;
            transition: box-shadow 0.2s;
        }
        .exam-card:hover {
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }
        .exam-card .card-image {
            height: 7rem;
            background: linear-gradient(135deg, #6366f1, #8b5cf6, #7c3aed);
            position: relative;
            overflow: hidden;
        }
        .exam-card .card-image .circle {
            position: absolute;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
        }
        .exam-card .card-image .circle-1 {
            top: -1rem;
            left: -1rem;
            width: 5rem;
            height: 5rem;
        }
        .exam-card .card-image .circle-2 {
            top: 1.5rem;
            left: 2rem;
            width: 2.5rem;
            height: 2.5rem;
        }
        .exam-card .card-image .circle-3 {
            bottom: -1rem;
            right: 1rem;
            width: 4rem;
            height: 4rem;
        }
        .exam-card .card-image .circle-4 {
            bottom: 1rem;
            right: 3rem;
            width: 2rem;
            height: 2rem;
        }
        .exam-card .card-image .circle-5 {
            top: 0.5rem;
            right: 0.5rem;
            width: 1.5rem;
            height: 1.5rem;
        }
        .exam-card .card-footer {
            padding: 0.5rem 0.75rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .exam-card .card-footer span {
            font-size: 0.875rem;
            font-weight: 500;
            color: #1d4ed8;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .exam-card .card-footer span:hover {
            text-decoration: underline;
        }
        .exam-card .card-footer button {
            background: none;
            border: none;
            color: #64748b;
            cursor: pointer;
            flex-shrink: 0;
            margin-left: 0.5rem;
        }
        .exam-card .card-footer button:hover {
            color: #0f172a;
        }
        .social-card .card-image {
            background: linear-gradient(135deg, #34d399, #2dd4bf, #06b6d4);
        }
        .social-card .card-image .circle-1 {
            top: -1rem;
            left: -1rem;
            width: 5rem;
            height: 5rem;
        }
        .social-card .card-image .circle-2 {
            top: 1.5rem;
            left: 2rem;
            width: 2.5rem;
            height: 2.5rem;
        }
        .social-card .card-image .circle-3 {
            bottom: -1rem;
            right: 1rem;
            width: 4rem;
            height: 4rem;
        }
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1f2937;
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-family: 'Inter', sans-serif;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 90%;
        }
        .toast.show { opacity: 1; }
        .toast.error { background: #dc2626; }
        .toast.success { background: #16a34a; }
        @media (max-width: 480px) {
            .info-box .info-row {
                grid-template-columns: 1fr 1fr;
                gap: 0.25rem 0.5rem;
            }
            .main-content {
                padding: 1rem;
            }
            .search-bar {
                width: 100%;
            }
            .exam-grid {
                gap: 0.75rem;
            }
        }
    </style>
</head>
<body>

    <div class="toast" id="toast"></div>

    <div id="root">
        <div class="min-h-screen" style="min-height:100vh;background:#ffffff;display:flex;flex-direction:column;">

            <!-- ===== HEADER ===== -->
            <header class="app-header">
                <div class="logo">🏫 Hayyo</div>
                <nav>
                    <a href="#" class="active">Home</a>
                    <a href="exams.html">My exam</a>
                    <a href="#" class="logout-btn" id="logoutBtn">Logout</a>
                </nav>
                <div class="user-menu">
                    <div class="avatar" id="userAvatar">ST</div>
                </div>
            </header>

            <!-- ===== RED LINE ===== -->
            <div class="red-line"></div>

            <!-- ===== MAIN CONTENT ===== -->
            <main class="main-content">

                <!-- Basic Information -->
                <div class="info-box">
                    <div class="info-header">Basic Information</div>
                    <div class="info-row">
                        <span class="label">Full Name:</span>
                        <span class="value" id="userName">Loading...</span>
                        <span class="label">School:</span>
                        <span class="value">Hayyo Academy</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Email:</span>
                        <span class="value" id="userEmail">Loading...</span>
                        <span class="label">Admission Number:</span>
                        <span class="value">HAY001</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Exam Center:</span>
                        <span class="value">ADDIS ABABA</span>
                        <span class="label">Enrollment Type:</span>
                        <span class="value">Regular</span>
                    </div>
                </div>

                <!-- Welcome Section -->
                <div class="welcome-section">
                    <h1>Welcome, <span id="welcomeName">Student</span>! 👋</h1>
                    <h2>Select Exam Category</h2>

                    <!-- Search Bar -->
                    <div class="search-bar">
                        <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path>
                            <path d="M21 21l-6 -6"></path>
                        </svg>
                        <input placeholder="Search" value="" />
                    </div>

                    <!-- Exam Categories Grid -->
                    <div class="exam-grid">

                        <!-- Natural Science Card -->
                        <div class="exam-card" onclick="window.location.href='exams.html'">
                            <div class="card-image">
                                <div class="circle circle-1"></div>
                                <div class="circle circle-2"></div>
                                <div class="circle circle-3"></div>
                                <div class="circle circle-4"></div>
                                <div class="circle circle-5"></div>
                            </div>
                            <div class="card-footer">
                                <span>🔬 Natural Science</span>
                                <button>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path></svg>
                                </button>
                            </div>
                        </div>

                        <!-- Social Science Card -->
                        <div class="exam-card social-card" onclick="window.location.href='exams.html'">
                            <div class="card-image">
                                <div class="circle circle-1"></div>
                                <div class="circle circle-2"></div>
                                <div class="circle circle-3"></div>
                            </div>
                            <div class="card-footer">
                                <span>🌍 Social Science</span>
                                <button>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path></svg>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

            </main>
        </div>
    </div>

    <script>
        // ============================================
        // API CONFIGURATION
        // ============================================
        const API_BASE = 'https://hayyo-exam.onrender.com';

        // ============================================
        // TOAST NOTIFICATION
        // ============================================
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type + ' show';
            setTimeout(() => { toast.className = 'toast'; }, 3000);
        }

        // ============================================
        // TOKEN HELPERS
        // ============================================
        function getToken() {
            return localStorage.getItem('token');
        }

        function setToken(token) {
            if (token) {
                localStorage.setItem('token', token);
                return true;
            }
            return false;
        }

        function clearToken() {
            localStorage.removeItem('token');
        }

        // ============================================
        // API CALL
        // ============================================
        function apiCall(endpoint, options = {}) {
            const token = getToken();
            return fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                    ...options.headers
                }
            });
        }

        // ============================================
        // MAIN AUTH CHECK - FIXED
        // ============================================
        function checkAuth() {
            console.log('🔍 Dashboard loaded, checking auth...');
            
            // 1️⃣ Check URL for token
            const urlParams = new URLSearchParams(window.location.search);
            let token = urlParams.get('token');
            
            if (token) {
                console.log('✅ Token found in URL');
                localStorage.setItem('token', token);
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                showToast('✅ Login successful!', 'success');
            }
            
            // 2️⃣ Get token from localStorage
            token = localStorage.getItem('token');
            
            if (!token) {
                console.log('❌ No token found - redirecting to login');
                showToast('Please login first', 'error');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
                return;
            }
            
            console.log('✅ Token found in localStorage');
            
            // 3️⃣ SHOW DASHBOARD IMMEDIATELY (don't wait for API)
            document.getElementById('userName').textContent = 'LOADING...';
            document.getElementById('welcomeName').textContent = 'Student';
            document.getElementById('userAvatar').textContent = 'ST';
            document.getElementById('userEmail').textContent = 'Loading...';
            
            // 4️⃣ Try to get user data (but DON'T redirect if it fails)
            console.log('🔍 Fetching user data from /api/me...');
            
            apiCall('/api/me')
                .then(async res => {
                    console.log('🔍 /api/me response status:', res.status);
                    
                    // Try to get response data
                    let data;
                    try {
                        data = await res.json();
                        console.log('🔍 Response data:', data);
                    } catch (e) {
                        console.log('❌ Failed to parse response');
                        // Stay on dashboard - don't redirect!
                        updateDashboardWithGuest();
                        return;
                    }
                    
                    // Check if token is invalid
                    if (res.status === 401) {
                        console.log('⚠️ Token invalid (401), but staying on dashboard');
                        // DON'T redirect - just show guest mode
                        updateDashboardWithGuest();
                        showToast('⚠️ Session expired, but you can still browse', 'error');
                        return;
                    }
                    
                    // Check if API call succeeded
                    if (data && data.authenticated) {
                        console.log('✅ User data loaded successfully!');
                        updateDashboardWithUser(data.user);
                        showToast('Welcome, ' + (data.user.name || 'Student') + '!', 'success');
                    } else {
                        console.log('❌ Authentication failed, but staying on dashboard');
                        updateDashboardWithGuest();
                        showToast('Could not load user data', 'error');
                    }
                })
                .catch(error => {
                    console.log('❌ API call error:', error.message);
                    // DON'T redirect - stay on dashboard!
                    updateDashboardWithGuest();
                    showToast('Network error, but you are logged in', 'error');
                });
            
            console.log('✅ Dashboard will stay open');
        }

        // ============================================
        // UPDATE UI WITH USER DATA
        // ============================================
        function updateDashboardWithUser(user) {
            const userName = user.name || 'Student';
            const userEmail = user.email || 'No email provided';
            
            document.getElementById('userName').textContent = userName.toUpperCase();
            document.getElementById('userEmail').textContent = userEmail;
            document.getElementById('welcomeName').textContent = userName;
            
            const initials = userName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            document.getElementById('userAvatar').textContent = initials;
            
            console.log('✅ Dashboard fully rendered with user data');
        }

        function updateDashboardWithGuest() {
            document.getElementById('userName').textContent = 'GUEST USER';
            document.getElementById('userEmail').textContent = 'guest@hayyo.com';
            document.getElementById('welcomeName').textContent = 'Guest';
            document.getElementById('userAvatar').textContent = 'GU';
            console.log('✅ Dashboard rendered in guest mode');
        }

        // ============================================
        // LOGOUT
        // ============================================
        function logout() {
            console.log('🔍 Logging out...');
            clearToken();
            showToast('Logged out successfully', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        }

        // ============================================
        // INITIALIZE
        // ============================================
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🔐 HAYYO Dashboard - JWT Authentication');
            
            // Check authentication (shows dashboard immediately)
            checkAuth();
            
            // Setup logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    logout();
                });
            }
        });
    </script>

</body>
</html>
