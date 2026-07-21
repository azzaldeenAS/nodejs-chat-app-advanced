const pool = require('./config/db');

async function migrate() {
  try {
    const client = await pool.connect();
    console.log('📦 متصل بقاعدة بيانات PostgreSQL بنجاح.');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        avatar_url VARCHAR(500) DEFAULT '/uploads/default-avatar.png'
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
        avatar_url VARCHAR(500) DEFAULT '/uploads/default-group.png',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // إضافة الأعمدة إذا لم تكن موجودة مسبقاً في الجداول الحالية
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT \'/uploads/default-avatar.png\';');
      await client.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT \'/uploads/default-group.png\';');
    } catch(err) {
      console.log('Columns already exist or error adding them:', err.message);
    }

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
