#!/usr/bin/env node

/**
 * Test Real-time Updates Fix
 * 
 * This script tests the real-time functionality by:
 * 1. Connecting to the WebSocket server
 * 2. Making API calls to create/update/delete orders
 * 3. Verifying that real-time updates are received
 */

const WebSocket = require('ws');
const https = require('http');

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:8081';

class RealtimeFixTester {
  constructor() {
    this.ws = null;
    this.updateCount = 0;
    this.testOrders = [];
    this.receivedUpdates = [];
  }

  async start() {
    console.log('🧪 Testing Real-time Updates Fix\n');
    
    // Connect to WebSocket
    await this.connectWebSocket();
    
    // Wait a moment for connection to establish
    await this.sleep(2000);
    
    // Run test scenarios
    await this.runTests();
    
    // Show results
    this.showResults();
  }

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      console.log('📡 Connecting to WebSocket server...');
      
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected successfully!\n');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data);
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
      });
    });
  }

  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'initial_data') {
        console.log(`📋 Initial data received: ${message.data.length} orders`);
        return;
      }
      
      if (message.type === 'orders_refresh') {
        this.updateCount++;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`\n🔄 Real-time Update #${this.updateCount} [${timestamp}]`);
        console.log(`   📊 Orders count: ${message.data.length}`);
        console.log(`   🆕 Latest order: ${message.data[0] ? `${message.data[0].customer_name} - ${message.data[0].product_name}` : 'None'}`);
        
        this.receivedUpdates.push({
          timestamp: new Date(),
          orderCount: message.data.length,
          latestOrder: message.data[0]
        });
      }
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  async runTests() {
    console.log('🧪 Running real-time update tests...\n');
    
    // Test 1: Create a new order
    console.log('Test 1: Creating a new order...');
    const newOrder = await this.createOrder('Real-time Test User', 'Real-time Test Product', 'pending');
    if (newOrder) {
      console.log(`✅ Order created with ID: ${newOrder.id}`);
      this.testOrders.push(newOrder.id);
      await this.sleep(3000); // Wait for real-time update
      
      // Test 2: Update the order
      console.log('\nTest 2: Updating order status...');
      const updatedOrder = await this.updateOrder(newOrder.id, { status: 'shipped' });
      if (updatedOrder) {
        console.log(`✅ Order updated successfully`);
        await this.sleep(3000); // Wait for real-time update
        
        // Test 3: Delete the order
        console.log('\nTest 3: Deleting the order...');
        const deleted = await this.deleteOrder(newOrder.id);
        if (deleted) {
          console.log(`✅ Order deleted successfully`);
          await this.sleep(3000); // Wait for real-time update
        }
      }
    }
  }

  async createOrder(customerName, productName, status) {
    try {
      const response = await this.makeRequest('POST', '/api/orders', {
        customer_name: customerName,
        product_name: productName,
        status: status
      });
      return response;
    } catch (error) {
      console.error('❌ Error creating order:', error.message);
      return null;
    }
  }

  async updateOrder(orderId, updates) {
    try {
      const response = await this.makeRequest('PUT', `/api/orders/${orderId}`, updates);
      return response;
    } catch (error) {
      console.error('❌ Error updating order:', error.message);
      return null;
    }
  }

  async deleteOrder(orderId) {
    try {
      const response = await this.makeRequest('DELETE', `/api/orders/${orderId}`);
      return response;
    } catch (error) {
      console.error('❌ Error deleting order:', error.message);
      return null;
    }
  }

  makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, API_BASE);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  showResults() {
    console.log('\n📊 Test Results:');
    console.log(`   🔄 Total real-time updates received: ${this.updateCount}`);
    console.log(`   📝 Updates logged: ${this.receivedUpdates.length}`);
    
    if (this.updateCount >= 3) {
      console.log('\n✅ SUCCESS: Real-time updates are working correctly!');
      console.log('   The system is detecting database changes and broadcasting updates to clients.');
    } else {
      console.log('\n❌ ISSUE: Not enough real-time updates received.');
      console.log('   Expected at least 3 updates (create, update, delete).');
    }
    
    console.log('\n💡 You can now test the web interface at http://localhost:3001');
    console.log('   Try adding orders through the web form and watch them appear in real-time!');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down test...');
  process.exit(0);
});

// Run the test
async function main() {
  try {
    const tester = new RealtimeFixTester();
    await tester.start();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RealtimeFixTester;
