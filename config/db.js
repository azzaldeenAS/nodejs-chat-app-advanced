const sqlite3 = require('sqlite3').verbose();

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

module.exports = db;
