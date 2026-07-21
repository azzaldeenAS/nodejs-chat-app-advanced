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
      try {
        const userRes = await pool.query('SELECT avatar_url FROM users WHERE username = $1', [username]);
        const avatar_url = userRes.rows[0] ? userRes.rows[0].avatar_url : '/uploads/default-avatar.png';
        socketUsers[socket.id] = { username, room, isPrivate: false, avatar_url };
        socket.join(room);
        
        const result = await pool.query(`
          SELECT * FROM (
            SELECT m.*, u.avatar_url 
            FROM messages m LEFT JOIN users u ON m.username = u.username 
            WHERE room = $1 ORDER BY timestamp DESC LIMIT 50
          ) sub ORDER BY timestamp ASC
        `, [room]);
        socket.emit('messageHistory', result.rows);
        socket.emit('message', { user: 'النظام', text: `مرحباً بك ${username} في غرفة "${room}"!`, avatar_url: '/uploads/default-group.png' });
        socket.broadcast.to(room).emit('message', { user: 'النظام', text: `انضم ${username} إلى المحادثة.`, avatar_url: '/uploads/default-group.png' });
        
        io.to(room).emit('roomUsers', { room: room, users: getRoomUsers(room) });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('joinPrivate', async ({ targetUser }) => {
      if (!session || !session.username) return;
      const username = session.username;
      const room = [username, targetUser].sort().join('_');
      
      try {
        const userRes = await pool.query('SELECT avatar_url FROM users WHERE username = $1', [username]);
        const avatar_url = userRes.rows[0] ? userRes.rows[0].avatar_url : '/uploads/default-avatar.png';
        socketUsers[socket.id] = { username, room, isPrivate: true, targetUser, avatar_url };
        socket.join(room);
        
        const result = await pool.query(`
          SELECT user_alias as user, text, timestamp, u.avatar_url 
          FROM (
            SELECT sender_username as user_alias, text, timestamp 
            FROM private_messages 
            WHERE (sender_username = $1 AND receiver_username = $2) 
               OR (sender_username = $2 AND receiver_username = $1)
            ORDER BY timestamp DESC LIMIT 50
          ) sub 
          LEFT JOIN users u ON sub.user_alias = u.username
          ORDER BY timestamp ASC
        `, [username, targetUser]);
        
        socket.emit('messageHistory', result.rows);
        socket.emit('message', { user: 'النظام', text: `محادثة خاصة ومؤمنة مع ${targetUser} 🔒`, avatar_url: '/uploads/default-avatar.png' });
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
            io.to(user.room).emit('message', { user: user.username, text: msg, avatar_url: user.avatar_url });
          } else {
            await pool.query(`INSERT INTO messages (room, username, text) VALUES ($1, $2, $3)`, [user.room, user.username, msg]);
            io.to(user.room).emit('message', { user: user.username, text: msg, avatar_url: user.avatar_url });
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
