const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../chat.db');
const db = new sqlite3.Database(dbPath);

const pool = {
  query: (text, params) => {
    return new Promise((resolve, reject) => {
      // Replace $1, $2, etc with ?
      let sqliteText = text;
      if (params) {
        for (let i = 1; i <= params.length; i++) {
          sqliteText = sqliteText.replace(`$${i}`, '?');
        }
      }
      
      // Auto incrementing postgres SERIAL mapped to SQLite INTEGER PRIMARY KEY AUTOINCREMENT
      // Let's also rewrite PostgreSQL specific types in case it's a CREATE TABLE query
      if (sqliteText.toUpperCase().includes('CREATE TABLE')) {
        sqliteText = sqliteText.replace(/SERIAL PRIMARY KEY/ig, 'INTEGER PRIMARY KEY AUTOINCREMENT');
        sqliteText = sqliteText.replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/ig, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
      }

      // Execute query
      if (sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.toUpperCase().includes('RETURNING')) {
        db.all(sqliteText, params || [], function(err, rows) {
          if (err) return reject(err);
          resolve({ rows: rows || [] });
        });
      } else {
        db.run(sqliteText, params || [], function(err) {
          if (err) return reject(err);
          resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
        });
      }
    });
  },
  connect: async () => {
    return {
      query: pool.query,
      release: () => {}
    };
  }
};

module.exports = pool;
