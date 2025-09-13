#!/usr/bin/env node

/**
 * CLI Client for Real-time Order Updates
 * 
 * A simple command-line client that connects to the WebSocket server
 * and displays real-time order updates in the terminal.
 */

const WebSocket = require('ws');
const readline = require('readline');

const WS_URL = 'ws://localhost:8081';

class CLIClient {
  constructor() {
    this.ws = null;
    this.rl = null;
    this.updateCount = 0;
    this.isConnected = false;
  }

  start() {
    console.log('🚀 Real-time Order Updates CLI Client\n');
    console.log('Connecting to WebSocket server...\n');
    
    this.connectWebSocket();
    this.setupReadline();
  }

  connectWebSocket() {
    this.ws = new WebSocket(WS_URL);
    
    this.ws.on('open', () => {
      this.isConnected = true;
      console.log('✅ Connected to WebSocket server!');
      console.log('📡 Listening for real-time order updates...\n');
      console.log('💡 Type "help" for available commands or "quit" to exit.\n');
      this.showPrompt();
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });
    
    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      this.isConnected = false;
    });
    
    this.ws.on('close', () => {
      console.log('\n🔌 WebSocket connection closed');
      this.isConnected = false;
      process.exit(0);
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'initial_data') {
        console.log(`📋 Initial data received: ${message.data.length} orders in database\n`);
        return;
      }
      
      if (message.type === 'order_update') {
        this.updateCount++;
        this.displayOrderUpdate(message.data);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error.message);
    }
  }

  displayOrderUpdate(orderData) {
    const timestamp = new Date().toLocaleTimeString();
    const operation = orderData.operation;
    
    // Color coding for different operations
    let operationColor = '';
    let operationIcon = '';
    
    switch (operation) {
      case 'INSERT':
        operationColor = '\x1b[32m'; // Green
        operationIcon = '➕';
        break;
      case 'UPDATE':
        operationColor = '\x1b[33m'; // Yellow
        operationIcon = '🔄';
        break;
      case 'DELETE':
        operationColor = '\x1b[31m'; // Red
        operationIcon = '🗑️';
        break;
      default:
        operationColor = '\x1b[37m'; // White
        operationIcon = '📝';
    }
    
    console.log(`${operationColor}${operationIcon} Update #${this.updateCount} [${timestamp}]${'\x1b[0m'}`);
    console.log(`   ${operationColor}Operation:${'\x1b[0m'} ${operation}`);
    console.log(`   ${operationColor}Order ID:${'\x1b[0m'} ${orderData.id}`);
    console.log(`   ${operationColor}Customer:${'\x1b[0m'} ${orderData.customer_name}`);
    console.log(`   ${operationColor}Product:${'\x1b[0m'} ${orderData.product_name}`);
    console.log(`   ${operationColor}Status:${'\x1b[0m'} ${orderData.status}`);
    console.log(`   ${operationColor}Updated:${'\x1b[0m'} ${new Date(orderData.updated_at).toLocaleString()}`);
    console.log('');
    
    this.showPrompt();
  }

  setupReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.rl.on('line', (input) => {
      this.handleCommand(input.trim());
    });
    
    this.rl.on('close', () => {
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });
  }

  handleCommand(input) {
    const command = input.toLowerCase();
    
    switch (command) {
      case 'help':
        this.showHelp();
        break;
      case 'status':
        this.showStatus();
        break;
      case 'count':
        this.showUpdateCount();
        break;
      case 'clear':
        console.clear();
        break;
      case 'quit':
      case 'exit':
        this.quit();
        break;
      case '':
        // Empty input, just show prompt
        break;
      default:
        console.log(`❓ Unknown command: "${input}"`);
        console.log('💡 Type "help" for available commands.\n');
    }
    
    this.showPrompt();
  }

  showHelp() {
    console.log('\n📖 Available Commands:');
    console.log('   help    - Show this help message');
    console.log('   status  - Show connection status');
    console.log('   count   - Show number of updates received');
    console.log('   clear   - Clear the screen');
    console.log('   quit    - Exit the client');
    console.log('');
  }

  showStatus() {
    const status = this.isConnected ? '✅ Connected' : '❌ Disconnected';
    console.log(`\n📊 Connection Status: ${status}`);
    console.log(`📡 WebSocket URL: ${WS_URL}`);
    console.log(`🔄 Updates Received: ${this.updateCount}`);
    console.log('');
  }

  showUpdateCount() {
    console.log(`\n📊 Total Updates Received: ${this.updateCount}\n`);
  }

  showPrompt() {
    if (this.rl) {
      this.rl.prompt();
    }
  }

  quit() {
    console.log('\n👋 Disconnecting...');
    if (this.ws) {
      this.ws.close();
    }
    if (this.rl) {
      this.rl.close();
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down CLI client...');
  process.exit(0);
});

// Start the CLI client
const client = new CLIClient();
client.start();
