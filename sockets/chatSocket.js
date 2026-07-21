const pool = require('../config/db');

const socketUsers = {}; 

function getRoomUsers(room) {
  return Object.values(socketUsers).filter(user => user.room === room).map(u => u.username);
}

module.exports = (io, sessionMiddleware) => {
  io.engine.use(sessionMiddleware);

  io.on('connection', (socket) => {
    const session = socket.request.session;
    
    socket.on('joinRoom', async ({ room }) => {
      if (!session || !session.username) return socket.emit('error', 'يجب تسجيل الدخول');

      const username = session.username;
      socketUsers[socket.id] = { username, room, isPrivate: false };
      socket.join(room);
      
      try {
        const result = await pool.query(`SELECT * FROM (SELECT * FROM messages WHERE room = $1 ORDER BY timestamp DESC LIMIT 50) sub ORDER BY timestamp ASC`, [room]);
        socket.emit('messageHistory', result.rows);
        socket.emit('message', { user: 'النظام', text: `مرحباً بك ${username} في غرفة "${room}"!` });
        socket.broadcast.to(room).emit('message', { user: 'النظام', text: `انضم ${username} إلى المحادثة.` });
        
        io.to(room).emit('roomUsers', { room: room, users: getRoomUsers(room) });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('joinPrivate', async ({ targetUser }) => {
      if (!session || !session.username) return;
      const username = session.username;
      const room = [username, targetUser].sort().join('_');
      socketUsers[socket.id] = { username, room, isPrivate: true, targetUser };
      socket.join(room);
      
      try {
        const result = await pool.query(`
          SELECT sender_username as user, text, timestamp 
          FROM (
            SELECT * FROM private_messages 
            WHERE (sender_username = $1 AND receiver_username = $2) 
               OR (sender_username = $2 AND receiver_username = $1)
            ORDER BY timestamp DESC LIMIT 50
          ) sub ORDER BY timestamp ASC
        `, [username, targetUser]);
        
        socket.emit('messageHistory', result.rows);
        socket.emit('message', { user: 'النظام', text: `محادثة خاصة ومؤمنة مع ${targetUser} 🔒` });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('chatMessage', async (msg) => {
      const user = socketUsers[socket.id];
      if (user) {
        try {
          if (user.isPrivate) {
            await pool.query(`INSERT INTO private_messages (sender_username, receiver_username, text) VALUES ($1, $2, $3)`, [user.username, user.targetUser, msg]);
            io.to(user.room).emit('message', { user: user.username, text: msg });
          } else {
            await pool.query(`INSERT INTO messages (room, username, text) VALUES ($1, $2, $3)`, [user.room, user.username, msg]);
            io.to(user.room).emit('message', { user: user.username, text: msg });
          }
        } catch(err) {
          console.error(err);
        }
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
        if (!user.isPrivate) {
          io.to(user.room).emit('message', { user: 'النظام', text: `غادر ${user.username} المحادثة.` });
          io.to(user.room).emit('roomUsers', { room: user.room, users: getRoomUsers(user.room) });
        }
        delete socketUsers[socket.id];
      }
    });
  });
};
