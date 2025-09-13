#!/usr/bin/env node

/**
 * Real-time System Test Script
 * 
 * This script demonstrates the real-time functionality by:
 * 1. Connecting to the WebSocket server
 * 2. Listening for real-time updates
 * 3. Making API calls to trigger database changes
 * 4. Showing how updates are received in real-time
 */

const WebSocket = require('ws');
const https = require('http');

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:8081';

class RealtimeTester {
  constructor() {
    this.ws = null;
    this.updateCount = 0;
    this.testOrders = [];
  }

  async start() {
    console.log('🚀 Starting Real-time System Test\n');
    
    // Connect to WebSocket
    await this.connectWebSocket();
    
    // Wait a moment for connection to establish
    await this.sleep(1000);
    
    // Run test scenarios
    await this.runTests();
    
    // Keep the script running to show real-time updates
    console.log('\n✅ Test completed! The WebSocket connection will remain open to show real-time updates.');
    console.log('💡 Try making changes through the web interface at http://localhost:3001');
    console.log('🔄 Or use the API directly to see real-time updates here.\n');
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
        console.log(`📋 Received initial data: ${message.data.length} orders`);
        return;
      }
      
      if (message.type === 'order_update') {
        this.updateCount++;
        const orderData = message.data;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`\n🔄 Real-time Update #${this.updateCount} [${timestamp}]`);
        console.log(`   Operation: ${orderData.operation}`);
        console.log(`   Order ID: ${orderData.id}`);
        console.log(`   Customer: ${orderData.customer_name}`);
        console.log(`   Product: ${orderData.product_name}`);
        console.log(`   Status: ${orderData.status}`);
        console.log(`   Updated: ${new Date(orderData.updated_at).toLocaleString()}`);
        
        // Store test orders for cleanup
        if (orderData.operation === 'INSERT') {
          this.testOrders.push(orderData.id);
        }
      }
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  async runTests() {
    console.log('🧪 Running test scenarios...\n');
    
    // Test 1: Create a new order
    console.log('Test 1: Creating a new order...');
    const newOrder = await this.createOrder('Test Customer', 'Test Product', 'pending');
    if (newOrder) {
      console.log(`✅ Order created with ID: ${newOrder.id}\n`);
      await this.sleep(2000);
      
      // Test 2: Update the order
      console.log('Test 2: Updating order status...');
      const updatedOrder = await this.updateOrder(newOrder.id, { status: 'shipped' });
      if (updatedOrder) {
        console.log(`✅ Order updated successfully\n`);
        await this.sleep(2000);
        
        // Test 3: Delete the order
        console.log('Test 3: Deleting the order...');
        const deleted = await this.deleteOrder(newOrder.id);
        if (deleted) {
          console.log(`✅ Order deleted successfully\n`);
        }
      }
    }
    
    await this.sleep(1000);
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test orders...');
    for (const orderId of this.testOrders) {
      try {
        await this.deleteOrder(orderId);
        console.log(`✅ Cleaned up order ${orderId}`);
      } catch (error) {
        console.log(`⚠️  Could not clean up order ${orderId}: ${error.message}`);
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down test script...');
  if (global.tester) {
    await global.tester.cleanup();
  }
  process.exit(0);
});

// Run the test
async function main() {
  try {
    global.tester = new RealtimeTester();
    await global.tester.start();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RealtimeTester;
