require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');

// استيراد الملفات المقسمة (MVC)
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const chatSocket = require('./sockets/chatSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// إعداد الجلسات (Sessions)
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'my-super-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // يوم واحد
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use(require('passport').initialize());

// تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// استخدام المسارات (Routes)
app.use('/api', authRoutes);
app.use('/', uploadRoutes);

// تشغيل نظام المقابس (Sockets)
chatSocket(io, sessionMiddleware);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 خادم المراسلة (النسخة المتطورة MVC) يعمل على المنفذ ${PORT}`);
});
