const { Pool, Client } = require('pg');
require('dotenv').config();

async function testDatabaseTriggers() {
  console.log('🧪 Testing Database Triggers and LISTEN/NOTIFY\n');

  // Create a pool for regular queries
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 30000
  });

  // Create a separate client for listening
  const listener = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Connect the listener
    console.log('📡 Connecting database listener...');
    await listener.connect();
    console.log('✅ Listener connected');

    // Start listening
    await listener.query('LISTEN order_changes');
    console.log('✅ Listening for order_changes notifications');

    // Set up notification handler
    listener.on('notification', (msg) => {
      console.log('🔔 NOTIFICATION RECEIVED:');
      console.log('   Channel:', msg.channel);
      console.log('   Payload:', msg.payload);
      console.log('   Process ID:', msg.processId);
    });

    listener.on('error', (error) => {
      console.error('❌ Listener error:', error);
    });

    // Wait a moment for listener to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 1: Insert a new order
    console.log('\n🧪 Test 1: Inserting new order...');
    const insertResult = await pool.query(
      'INSERT INTO orders (customer_name, product_name, status) VALUES ($1, $2, $3) RETURNING *',
      ['Test Customer', 'Test Product', 'pending']
    );
    console.log('✅ Order inserted:', insertResult.rows[0]);

    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Update the order
    console.log('\n🧪 Test 2: Updating order...');
    const updateResult = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      ['shipped', insertResult.rows[0].id]
    );
    console.log('✅ Order updated:', updateResult.rows[0]);

    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Delete the order
    console.log('\n🧪 Test 3: Deleting order...');
    const deleteResult = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [insertResult.rows[0].id]
    );
    console.log('✅ Order deleted:', deleteResult.rows[0]);

    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n✅ Database trigger tests completed!');
    console.log('💡 If you saw notifications above, the triggers are working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await listener.end();
    await pool.end();
  }
}

// Run the test
testDatabaseTriggers();
