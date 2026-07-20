const db = require('../config/db');

const socketUsers = {}; 

function getRoomUsers(room) {
  return Object.values(socketUsers).filter(user => user.room === room).map(u => u.username);
}

module.exports = (io, sessionMiddleware) => {
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
};
