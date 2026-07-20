const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// إعداد الجلسات (Sessions)
const sessionMiddleware = session({
  secret: 'my-super-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // يوم واحد
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// إعداد رفع الملفات (Multer)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// إعداد قاعدة البيانات (SQLite)
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) console.error('خطأ في الاتصال بقاعدة البيانات:', err.message);
  else console.log('📁 متصل بقاعدة بيانات SQLite.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    username TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);
});

// تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// مسارات المصادقة (Authentication APIs)
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
    if (row) return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) return res.status(500).json({ error: 'حدث خطأ في الخادم' });
      req.session.userId = this.lastID;
      req.session.username = username;
      res.json({ success: true, username });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'الرجاء إدخال جميع الحقول' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (!user) return res.status(400).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session.username) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// مسار رفع الصور
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع أي ملف.' });
  const imageUrl = '/uploads/' + req.file.filename;
  res.json({ imageUrl });
});

const socketUsers = {}; 

function getRoomUsers(room) {
  return Object.values(socketUsers).filter(user => user.room === room).map(u => u.username);
}

// دمج الجلسة مع Socket.io لمعرفة من المتصل
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
  const session = socket.request.session;
  
  socket.on('joinRoom', ({ room }) => {
    if (!session || !session.username) return socket.emit('error', 'يجب تسجيل الدخول');

    const username = session.username;
    socketUsers[socket.id] = { username, room };
    socket.join(room);
    
    db.all(`SELECT * FROM messages WHERE room = ? ORDER BY timestamp ASC LIMIT 50`, [room], (err, rows) => {
      if (err) throw err;
      socket.emit('messageHistory', rows);
      socket.emit('message', { user: 'النظام', text: `مرحباً بك ${username} في غرفة "${room}"!` });
      socket.broadcast.to(room).emit('message', { user: 'النظام', text: `انضم ${username} إلى المحادثة.` });
      
      io.to(room).emit('roomUsers', { room: room, users: getRoomUsers(room) });
    });
  });

  socket.on('chatMessage', (msg) => {
    const user = socketUsers[socket.id];
    if (user) {
      db.run(`INSERT INTO messages (room, username, text) VALUES (?, ?, ?)`, [user.room, user.username, msg], function(err) {
        if (err) return console.error(err.message);
        io.to(user.room).emit('message', { user: user.username, text: msg });
      });
    }
  });

  socket.on('typing', () => {
    const user = socketUsers[socket.id];
    if (user) socket.broadcast.to(user.room).emit('typing', user.username);
  });

  socket.on('stopTyping', () => {
    const user = socketUsers[socket.id];
    if (user) socket.broadcast.to(user.room).emit('stopTyping', user.username);
  });

  socket.on('disconnect', () => {
    const user = socketUsers[socket.id];
    if (user) {
      io.to(user.room).emit('message', { user: 'النظام', text: `غادر ${user.username} المحادثة.` });
      delete socketUsers[socket.id];
      io.to(user.room).emit('roomUsers', { room: user.room, users: getRoomUsers(user.room) });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 خادم المراسلة (مع نظام المصادقة) يعمل على المنفذ ${PORT}`);
});
