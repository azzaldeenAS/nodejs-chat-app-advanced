const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:ezz-chat-db@db.cdrlsqbojkcjqtnezdwb.supabase.co:6543/postgres'
});

async function test() {
  try {
    await client.connect();
    console.log('SUCCESS');
    await client.end();
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}
test();
