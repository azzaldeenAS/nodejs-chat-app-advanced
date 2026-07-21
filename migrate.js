const pool = require('./config/db');

async function migrate() {
  try {
    const client = await pool.connect();
    console.log('📦 متصل بقاعدة بيانات PostgreSQL بنجاح.');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255)
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        sender_username VARCHAR(255) NOT NULL,
        receiver_username VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // إدخال الغرف الافتراضية إذا لم تكن موجودة
    await client.query(`
      INSERT INTO rooms (name, created_by) VALUES 
      ('العامة', 'النظام'),
      ('المبرمجين', 'النظام'),
      ('الألعاب', 'النظام')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('✅ تم تجهيز الجداول بنجاح.');
    client.release();
  } catch (err) {
    console.error('❌ فشل في الاتصال أو تجهيز قاعدة البيانات:', err.stack);
  }
}

migrate();
