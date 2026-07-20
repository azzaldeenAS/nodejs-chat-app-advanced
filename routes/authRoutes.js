const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول' });

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id', [username, hashedPassword]);
    
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

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

module.exports = router;
