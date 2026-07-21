const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const router = express.Router();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://nodejs-chat-app-advanced.onrender.com/api/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let res = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
        if (res.rows.length > 0) {
          return done(null, res.rows[0]);
        }
        // إرجاع البروفايل لتكملة البيانات بدلاً من العشوائية
        return done(null, { isNewGoogleUser: true, profile: profile });
      } catch (err) {
        return done(err, null);
      }
    }
  ));
}

router.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(400).send('Google Auth is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.');
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
  if (req.user.isNewGoogleUser) {
    req.session.pendingGoogleUser = {
      google_id: req.user.profile.id,
      email: req.user.profile.emails[0].value
    };
    return res.redirect('/complete-profile.html');
  }
  
  req.session.userId = req.user.id;
  req.session.username = req.user.username;
  res.redirect('/');
});

router.post('/complete-google-profile', async (req, res) => {
  if (!req.session.pendingGoogleUser) return res.status(400).json({ error: 'لا يوجد تسجيل دخول معلق بجوجل' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
  
  try {
    const { google_id, email } = req.session.pendingGoogleUser;
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'اسم المستخدم أو الإيميل مسجل مسبقاً' });
    
    const result = await pool.query('INSERT INTO users (username, email, google_id) VALUES ($1, $2, $3) RETURNING *', [username, email, google_id]);
    req.session.pendingGoogleUser = null;
    req.session.userId = result.rows[0].id;
    req.session.username = result.rows[0].username;
    res.json({ success: true, username: result.rows[0].username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول' });

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'اسم المستخدم أو الإيميل مسجل مسبقاً' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id', [username, email, hashedPassword]);
    
    req.session.userId = result.rows[0].id;
    req.session.username = username;
    res.json({ success: true, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في الخادم: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول' });

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];
    
    if (!user) return res.status(400).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ في الخادم: ' + err.message });
  }
});

router.get('/me', (req, res) => {
  if (req.session.username) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

router.get('/users/search', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const q = req.query.q || '';
  try {
    const result = await pool.query('SELECT username FROM users WHERE username ILIKE $1 AND id != $2 LIMIT 10', [`%${q}%`, req.session.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

module.exports = router;
