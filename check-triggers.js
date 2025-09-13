const { Pool } = require('pg');
require('dotenv').config();

async function checkTriggers() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Check if triggers exist
    const triggerResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE trigger_name = 'order_changes_trigger'
    `);
    
    console.log('🔍 Triggers found:', triggerResult.rows.length);
    if (triggerResult.rows.length > 0) {
      console.log('✅ Trigger exists:', triggerResult.rows[0]);
    } else {
      console.log('❌ No trigger found!');
    }

    // Check if function exists
    const functionResult = await pool.query(`
      SELECT routine_name, routine_type 
      FROM information_schema.routines 
      WHERE routine_name = 'notify_order_changes'
    `);
    
    console.log('\n🔍 Functions found:', functionResult.rows.length);
    if (functionResult.rows.length > 0) {
      console.log('✅ Function exists:', functionResult.rows[0]);
    } else {
      console.log('❌ No function found!');
    }

    // Check table structure
    const tableResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `);
    
    console.log('\n🔍 Orders table columns:');
    tableResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkTriggers();
