#!/usr/bin/env node

/**
 * Simple WebSocket Test
 * 
 * This script connects to the WebSocket server and monitors for real-time updates
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8081';

console.log('🧪 Testing WebSocket Real-time Updates\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('📡 Listening for real-time updates...\n');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`📨 [${timestamp}] Received message:`);
    console.log(`   Type: ${message.type}`);
    
    if (message.type === 'initial_data') {
      console.log(`   📋 Initial data: ${message.data.length} orders`);
    } else if (message.type === 'orders_refresh') {
      console.log(`   🔄 Orders refresh: ${message.data.length} orders`);
      if (message.data.length > 0) {
        console.log(`   🆕 Latest order: ${message.data[0].customer_name} - ${message.data[0].product_name}`);
      }
    } else if (message.type === 'order_update') {
      console.log(`   🔄 Order update: ${message.data.operation} - ${message.data.customer_name}`);
    }
    
    console.log('');
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});

// Keep the script running
console.log('💡 This script will monitor WebSocket messages in real-time.');
console.log('   Try adding orders through the web interface or API to see updates.\n');
console.log('   Press Ctrl+C to exit.\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing WebSocket connection...');
  ws.close();
  process.exit(0);
});
