const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
  db.all("INSERT INTO test (name) VALUES ('hello') RETURNING id", (err, rows) => {
    console.log('Error:', err);
    console.log('Rows:', rows);
  });
});
