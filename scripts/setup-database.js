const { Pool } = require('pg');
require('dotenv').config();

async function setupDatabase() {
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

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected to database successfully!');

    // Create orders table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'shipped', 'delivered')),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log('Orders table created successfully!');

    // Create function to notify clients
    const createFunctionQuery = `
      CREATE OR REPLACE FUNCTION notify_order_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM pg_notify('order_changes', json_build_object(
            'operation', TG_OP,
            'id', OLD.id,
            'customer_name', OLD.customer_name,
            'product_name', OLD.product_name,
            'status', OLD.status,
            'updated_at', OLD.updated_at
          )::text);
          RETURN OLD;
        ELSE
          PERFORM pg_notify('order_changes', json_build_object(
            'operation', TG_OP,
            'id', NEW.id,
            'customer_name', NEW.customer_name,
            'product_name', NEW.product_name,
            'status', NEW.status,
            'updated_at', NEW.updated_at
          )::text);
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `;

    await client.query(createFunctionQuery);
    console.log('Notification function created successfully!');

    // Create trigger
    const createTriggerQuery = `
      DROP TRIGGER IF EXISTS order_changes_trigger ON orders;
      CREATE TRIGGER order_changes_trigger
        AFTER INSERT OR UPDATE OR DELETE ON orders
        FOR EACH ROW EXECUTE FUNCTION notify_order_changes();
    `;

    await client.query(createTriggerQuery);
    console.log('Trigger created successfully!');

    // Insert sample data
    const insertSampleDataQuery = `
      INSERT INTO orders (customer_name, product_name, status) VALUES
      ('John Doe', 'Laptop', 'pending'),
      ('Jane Smith', 'Mouse', 'shipped'),
      ('Bob Johnson', 'Keyboard', 'delivered')
      ON CONFLICT DO NOTHING;
    `;

    await client.query(insertSampleDataQuery);
    console.log('Sample data inserted successfully!');

    client.release();
    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;
