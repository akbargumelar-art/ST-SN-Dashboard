const mysql = require('mysql2');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sn_manager',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Handle dates as strings to match VARCHAR/DATE columns easily
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.code);
    console.error('Please ensure your MySQL server is running and credentials in .env are correct.');
  } else {
    console.log('Connected to MySQL Database');
    connection.release();
  }
});

module.exports = pool.promise();