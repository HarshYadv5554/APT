const { Pool } = require('pg');
require('dotenv').config();

async function resetSequence() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔄 Resetting order sequence to start from 1...');
    
    // Reset the sequence to start from 1
    await pool.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
    
    console.log('✅ Order sequence reset successfully!');
    console.log('📝 New orders will now start from ID #1');
    
  } catch (error) {
    console.error('❌ Error resetting sequence:', error);
  } finally {
    await pool.end();
  }
}

resetSequence();
