#!/usr/bin/env node

/**
 * Browser Simulation Test
 * 
 * This script simulates the browser's WebSocket behavior to test real-time updates
 */

const WebSocket = require('ws');
const https = require('http');

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:8081';

class BrowserSimulation {
  constructor() {
    this.ws = null;
    this.orders = [];
    this.updateCount = 0;
  }

  async start() {
    console.log('🌐 Browser Simulation Test\n');
    
    // Connect to WebSocket
    await this.connectWebSocket();
    
    // Wait for initial data
    await this.sleep(2000);
    
    // Test creating an order
    await this.testCreateOrder();
    
    // Wait for real-time update
    await this.sleep(3000);
    
    // Show results
    this.showResults();
  }

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      console.log('📡 Connecting to WebSocket...');
      
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
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
      const timestamp = new Date().toLocaleTimeString();
      
      console.log(`\n📨 [${timestamp}] WebSocket message received:`);
      console.log(`   Type: ${message.type}`);
      
      if (message.type === 'initial_data') {
        this.orders = message.data;
        console.log(`   📋 Initial data: ${this.orders.length} orders loaded`);
        this.updateCount++;
      } else if (message.type === 'orders_refresh') {
        this.orders = message.data;
        console.log(`   🔄 Orders refreshed: ${this.orders.length} orders`);
        console.log(`   🆕 Latest order: ${this.orders[0] ? `${this.orders[0].customer_name} - ${this.orders[0].product_name}` : 'None'}`);
        this.updateCount++;
      } else if (message.type === 'order_update') {
        console.log(`   🔄 Order update: ${message.data.operation} - ${message.data.customer_name}`);
        this.updateCount++;
      } else {
        console.log(`   ❓ Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  async testCreateOrder() {
    console.log('\n🧪 Testing order creation...');
    
    try {
      const response = await this.makeRequest('POST', '/api/orders', {
        customer_name: 'Browser Simulation Test',
        product_name: 'Browser Simulation Product',
        status: 'pending'
      });
      
      console.log(`✅ Order created with ID: ${response.id}`);
      console.log('⏳ Waiting for real-time update...');
      
    } catch (error) {
      console.error('❌ Error creating order:', error.message);
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
    console.log(`   🔄 Total WebSocket updates received: ${this.updateCount}`);
    console.log(`   📝 Current orders count: ${this.orders.length}`);
    
    if (this.updateCount >= 2) {
      console.log('\n✅ SUCCESS: Real-time updates are working!');
      console.log('   The WebSocket is receiving updates when orders are created.');
    } else {
      console.log('\n❌ ISSUE: Not enough WebSocket updates received.');
      console.log('   Expected at least 2 updates (initial data + order creation).');
    }
    
    console.log('\n💡 If this test passes, the issue might be in the browser client code.');
    console.log('   Check the browser console at http://localhost:3001 for any JavaScript errors.');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test
async function main() {
  try {
    const simulation = new BrowserSimulation();
    await simulation.start();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = BrowserSimulation;
