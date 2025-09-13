const { Pool, Client } = require('pg');
require('dotenv').config();

async function testListenNotify() {
  console.log('🧪 Testing LISTEN/NOTIFY mechanism\n');

  // Create a pool for sending notifications
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon') ? { rejectUnauthorized: false } : false,
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
    console.log('📡 Connecting listener...');
    await listener.connect();
    console.log('✅ Listener connected');

    // Start listening
    await listener.query('LISTEN test_channel');
    console.log('✅ Listening on test_channel');

    // Set up notification handler
    let notificationReceived = false;
    listener.on('notification', (msg) => {
      console.log('🔔 NOTIFICATION RECEIVED:');
      console.log('   Channel:', msg.channel);
      console.log('   Payload:', msg.payload);
      console.log('   Process ID:', msg.processId);
      notificationReceived = true;
    });

    listener.on('error', (error) => {
      console.error('❌ Listener error:', error);
    });

    // Wait a moment for listener to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send a test notification
    console.log('\n📤 Sending test notification...');
    await pool.query("SELECT pg_notify('test_channel', 'Hello from test!')");
    console.log('✅ Notification sent');

    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (notificationReceived) {
      console.log('\n✅ LISTEN/NOTIFY is working correctly!');
    } else {
      console.log('\n❌ LISTEN/NOTIFY is NOT working - no notification received');
    }

    // Now test with the actual order_changes channel
    console.log('\n🧪 Testing order_changes channel...');
    await listener.query('LISTEN order_changes');
    console.log('✅ Now listening on order_changes');

    // Send a test notification to order_changes
    await pool.query("SELECT pg_notify('order_changes', '{\"test\": \"message\"}')");
    console.log('✅ Test notification sent to order_changes');

    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await listener.end();
    await pool.end();
  }
}

testListenNotify();
