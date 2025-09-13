const express = require('express');
const WebSocket = require('ws');
const { Pool, Client } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

class RealtimeServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.wsPort = process.env.WS_PORT || 8081;
    this.clients = new Set();
    this.dbPool = null;
    this.dbListener = null;
    
    this.setupDatabase();
    this.setupExpress();
    this.setupWebSocket();
    this.setupDatabaseListener();
  }

  setupDatabase() {
    this.dbPool = new Pool({
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

    // Create a separate client for listening to notifications
    this.dbListener = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon') ? { rejectUnauthorized: false } : false,
    });
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API Routes
    this.app.get('/api/orders', async (req, res) => {
      try {
        const result = await this.dbPool.query('SELECT * FROM orders ORDER BY updated_at DESC');
        res.json(result.rows);
      } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
      }
    });

    this.app.post('/api/orders', async (req, res) => {
      try {
        const { customer_name, product_name, status = 'pending' } = req.body;
        
        if (!customer_name || !product_name) {
          return res.status(400).json({ error: 'customer_name and product_name are required' });
        }

        const result = await this.dbPool.query(
          'INSERT INTO orders (customer_name, product_name, status) VALUES ($1, $2, $3) RETURNING *',
          [customer_name, product_name, status]
        );
        
        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
      }
    });

    this.app.put('/api/orders/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { customer_name, product_name, status } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (customer_name !== undefined) {
          updates.push(`customer_name = $${paramCount++}`);
          values.push(customer_name);
        }
        if (product_name !== undefined) {
          updates.push(`product_name = $${paramCount++}`);
          values.push(product_name);
        }
        if (status !== undefined) {
          updates.push(`status = $${paramCount++}`);
          values.push(status);
        }

        if (updates.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await this.dbPool.query(query, values);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
      } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
      }
    });

    this.app.delete('/api/orders/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await this.dbPool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ message: 'Order deleted successfully', order: result.rows[0] });
      } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
      }
    });

    this.app.delete('/api/orders', async (req, res) => {
      try {
        const result = await this.dbPool.query('DELETE FROM orders RETURNING *');
        const deletedCount = result.rows.length;

        res.json({ 
          message: `All orders deleted successfully`, 
          deletedCount: deletedCount,
          orders: result.rows 
        });
      } catch (error) {
        console.error('Error clearing all orders:', error);
        res.status(500).json({ error: 'Failed to clear all orders' });
      }
    });

    // Serve the client
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.wsPort });
    
    this.wss.on('connection', (ws) => {
      console.log('New client connected');
      this.clients.add(ws);

      // Send current orders to new client
      this.sendCurrentOrders(ws);

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log(`WebSocket server running on port ${this.wsPort}`);
  }

  async setupDatabaseListener() {
    try {
      console.log('Attempting to connect database listener...');
      await this.dbListener.connect();
      console.log('✅ Database listener connected successfully');

      // Listen for order changes
      await this.dbListener.query('LISTEN order_changes');
      console.log('✅ Listening for order changes...');

      this.dbListener.on('notification', (msg) => {
        console.log('🔔 Database notification received:', msg.payload);
        console.log('📡 Broadcasting to', this.clients.size, 'clients');
        this.broadcastToClients(msg.payload);
      });

      this.dbListener.on('error', (error) => {
        console.error('❌ Database listener error:', error);
        console.log('🔄 Falling back to polling method...');
        this.setupPollingFallback();
      });

      // Force fallback after 3 seconds if no notifications are received
      // This handles cases where LISTEN/NOTIFY doesn't work properly
      setTimeout(() => {
        if (!this.pollingInterval) {
          console.log('🔄 LISTEN/NOTIFY timeout - falling back to polling method...');
          this.setupPollingFallback();
        }
      }, 3000);

    } catch (error) {
      console.error('❌ Failed to setup database listener:', error);
      console.error('Error details:', error.message);
      console.log('🔄 Falling back to polling method...');
      this.setupPollingFallback();
    }
  }

  setupPollingFallback() {
    console.log('🔄 Setting up efficient change detection...');
    this.lastOrderCount = 0;
    this.lastOrderTimestamp = null;
    this.lastOrderHash = null;
    
    // Poll every 1 second for changes
    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.dbPool.query(`
          SELECT COUNT(*) as count, MAX(updated_at) as last_update,
                 STRING_AGG(id::text || ':' || customer_name || ':' || product_name || ':' || status || ':' || updated_at::text, '|' ORDER BY id) as order_hash
          FROM orders
        `);
        
        const currentCount = parseInt(result.rows[0].count);
        const currentTimestamp = result.rows[0].last_update;
        const currentHash = result.rows[0].order_hash;
        
        // Check if there are actual changes by comparing hash
        if (currentHash !== this.lastOrderHash) {
          console.log('🔄 Database changes detected - broadcasting update');
          
          // Get the latest orders and broadcast them
          const ordersResult = await this.dbPool.query(`
            SELECT * FROM orders ORDER BY updated_at DESC
          `);
          
          // Only broadcast if there are connected clients
          if (this.clients.size > 0) {
            const message = JSON.stringify({
              type: 'orders_refresh',
              data: ordersResult.rows
            });
            
            this.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                console.log('📡 Sending orders_refresh to client');
                client.send(message);
              } else {
                console.log('🗑️ Removing disconnected client');
                this.clients.delete(client);
              }
            });
          }
          
          this.lastOrderCount = currentCount;
          this.lastOrderTimestamp = currentTimestamp;
          this.lastOrderHash = currentHash;
        }
      } catch (error) {
        console.error('❌ Change detection error:', error);
      }
    }, 1000);
    
    console.log('✅ Efficient change detection active (checking every 1 second)');
  }

  async sendCurrentOrders(ws) {
    try {
      const result = await this.dbPool.query('SELECT * FROM orders ORDER BY updated_at DESC');
      ws.send(JSON.stringify({
        type: 'initial_data',
        data: result.rows
      }));
    } catch (error) {
      console.error('Error sending current orders:', error);
    }
  }

  broadcastToClients(data) {
    const message = JSON.stringify({
      type: 'order_update',
      data: JSON.parse(data)
    });

    console.log('📤 Broadcasting order_update message:', message);
    console.log('👥 Connected clients:', this.clients.size);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        console.log('📡 Sending order_update to client');
        client.send(message);
      } else {
        console.log('🗑️ Removing disconnected client');
        this.clients.delete(client);
      }
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`HTTP server running on port ${this.port}`);
      console.log(`WebSocket server running on port ${this.wsPort}`);
      console.log(`Client available at http://localhost:${this.port}`);
    });
  }

  async shutdown() {
    console.log('Shutting down server...');
    
    // Clear polling interval if it exists
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      console.log('✅ Polling interval cleared');
    }
    
    // Close WebSocket connections
    this.clients.forEach((client) => {
      client.close();
    });
    
    // Close database connections
    if (this.dbListener) {
      await this.dbListener.end();
    }
    if (this.dbPool) {
      await this.dbPool.end();
    }
    
    process.exit(0);
  }
}

// Create and start the server
const server = new RealtimeServer();
server.start();

// Graceful shutdown
process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

module.exports = RealtimeServer;
