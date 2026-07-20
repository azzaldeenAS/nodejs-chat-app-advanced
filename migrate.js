const pool = require('./config/db');

async function migrate() {
  try {
    const client = await pool.connect();
    console.log('📦 متصل بقاعدة بيانات PostgreSQL بنجاح.');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ تم تجهيز الجداول بنجاح.');
    client.release();
  } catch (err) {
    console.error('❌ فشل في الاتصال أو تجهيز قاعدة البيانات:', err.stack);
  }
}

migrate();
