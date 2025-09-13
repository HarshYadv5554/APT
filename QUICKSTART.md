# 🚀 Quick Start Guide

Get the real-time database update system running in 3 simple steps!

## Step 1: Setup Database
```bash
npm run setup-db
```
This creates the orders table, triggers, and sample data.

## Step 2: Start Server
```bash
npm start
```
The server will start on:
- **Web Interface**: http://localhost:3001
- **WebSocket**: ws://localhost:8081

## Step 3: Test Real-time Updates

### Option A: Web Interface
1. Open http://localhost:3001 in your browser
2. Add new orders using the form
3. Watch real-time updates appear instantly!

### Option B: CLI Client
```bash
npm run cli
```
This opens a terminal client that shows real-time updates.

### Option C: Automated Test
```bash
npm test
```
This runs an automated test that creates, updates, and deletes orders.

## 🎯 What You'll See

- **Real-time Updates**: Changes appear instantly across all connected clients
- **No Polling**: Uses PostgreSQL LISTEN/NOTIFY for efficiency
- **Beautiful UI**: Modern, responsive web interface
- **Multiple Clients**: Test with multiple browser tabs or CLI clients

## 🔧 API Testing

Test the REST API directly:

```bash
# Get all orders
curl http://localhost:3001/api/orders

# Create new order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name": "Test User", "product_name": "Test Product", "status": "pending"}'

# Update order
curl -X PUT http://localhost:3001/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'

# Delete order
curl -X DELETE http://localhost:3001/api/orders/1
```

## 🎉 That's It!

You now have a fully functional real-time database update system. Try making changes through the web interface and watch them appear instantly in the CLI client or other browser tabs!

For more details, see the full [README.md](README.md).
