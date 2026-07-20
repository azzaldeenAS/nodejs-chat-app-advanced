const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ezz-chat-db@db.cdrlsqbojkcjqtnezdwb.supabase.co:5432/postgres',
});

pool.on('error', (err, client) => {
  console.error('خطأ غير متوقع في قاعدة البيانات', err);
});

module.exports = pool;
