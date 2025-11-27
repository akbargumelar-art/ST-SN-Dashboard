const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'rahasia_app_sn_manager_secure_key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increased limit for large CSV uploads
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- ROUTES ---

// 1. AUTH LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = rows[0];
    
    // Check password
    let validPass = false;
    // Support both hashed (production) and plain text (initial migration/demo) passwords
    if (user.password.startsWith('$2b$')) {
        validPass = await bcrypt.compare(password, user.password);
    } else {
        validPass = password === user.password;
    }

    if (!validPass) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ 
        token, 
        user: { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            name: user.name 
        } 
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// 2. REPORT SN (MASTER) - Table: serial_numbers
app.get('/api/serial-numbers', async (req, res) => {
  try {
    // Fetch latest 10000 records to prevent browser crash. Implement pagination for full data.
    const [rows] = await db.query(`
      SELECT 
        id, sn_number, flag, warehouse, sub_category, product_name, 
        expired_date, status, salesforce_name, tap, price, 
        transaction_id, no_rs, id_digipos, nama_outlet, created_at 
      FROM serial_numbers 
      ORDER BY created_at DESC 
      LIMIT 10000
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get SN Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/serial-numbers/bulk', async (req, res) => {
  const data = req.body; // Expect array of objects from frontend parsing
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ message: 'No data provided' });
  }

  // Map frontend object keys to array for bulk insert
  const values = data.map(item => [
    item.sn_number, 
    item.flag || '-', 
    item.warehouse || '-', 
    item.sub_category || '-', 
    item.product_name || '-', 
    item.expired_date || null, // DATE type in DB
    'Ready', // Default status
    item.salesforce_name || '-', 
    item.tap || '-', 
    0, // Default price
    null, // Default transaction_id
    item.no_rs || '-',
    new Date() // created_at
  ]);

  try {
    await db.query(
      `INSERT IGNORE INTO serial_numbers 
      (sn_number, flag, warehouse, sub_category, product_name, expired_date, status, salesforce_name, tap, price, transaction_id, no_rs, created_at) 
      VALUES ?`, 
      [values]
    );
    res.json({ message: `Successfully processed ${values.length} records.` });
  } catch (err) {
    console.error('Bulk Insert SN Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. SELLTHRU (UPDATE STATUS) - Table: serial_numbers
app.post('/api/serial-numbers/sellthru', async (req, res) => {
  const updates = req.body; // Array of objects
  
  if (!updates || !Array.isArray(updates)) return res.status(400).json({ message: 'Invalid data format' });

  let success = 0;
  let failed = 0;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Loop update is safe for moderate batch sizes (hundreds/thousands). 
    // For millions, LOAD DATA LOCAL INFILE or temp table join is preferred.
    for (const item of updates) {
      const [result] = await connection.query(
        `UPDATE serial_numbers SET 
         status = 'Sukses ST', 
         id_digipos = ?, 
         nama_outlet = ?, 
         price = ?, 
         transaction_id = ? 
         WHERE sn_number = ?`,
        [
          item.id_digipos, 
          item.nama_outlet, 
          item.price || 0, 
          item.transaction_id, 
          item.sn_number
        ]
      );
      
      if (result.affectedRows > 0) {
        success++;
      } else {
        failed++;
      }
    }

    await connection.commit();
    res.json({ 
      message: 'Sellthru update completed',
      success, 
      failed 
    });
  } catch (err) {
    await connection.rollback();
    console.error('Sellthru Update Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 4. TOPUP SALDO - Table: topup_transactions
app.get('/api/topup', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM topup_transactions ORDER BY created_at DESC LIMIT 5000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/topup/bulk', async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data)) return res.status(400).json({ message: 'No data provided' });

  const values = data.map(item => [
    item.transaction_date, // VARCHAR(50) based on your schema
    item.sender, 
    item.receiver, 
    item.transaction_type,
    item.amount, 
    item.currency, 
    item.remarks, 
    item.salesforce, 
    item.tap,
    item.id_digipos, 
    item.nama_outlet, 
    new Date() // created_at timestamp
  ]);
  
  try {
    await db.query(
      `INSERT INTO topup_transactions 
      (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet, created_at) 
      VALUES ?`,
      [values]
    );
    res.json({ message: 'Topup transactions imported successfully' });
  } catch (err) {
    console.error('Topup Import Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. BUCKET TRANSAKSI - Table: bucket_transactions
app.get('/api/bucket', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM bucket_transactions ORDER BY created_at DESC LIMIT 5000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bucket/bulk', async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data)) return res.status(400).json({ message: 'No data provided' });

  const values = data.map(item => [
    item.transaction_date, // VARCHAR(50)
    item.sender, 
    item.receiver, 
    item.transaction_type,
    item.amount, 
    item.currency, 
    item.remarks, 
    item.salesforce, 
    item.tap,
    item.id_digipos, 
    item.nama_outlet, 
    new Date()
  ]);
  
  try {
    await db.query(
      `INSERT INTO bucket_transactions 
      (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet, created_at) 
      VALUES ?`,
      [values]
    );
    res.json({ message: 'Bucket transactions imported successfully' });
  } catch (err) {
    console.error('Bucket Import Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. LIST SN ADISTI - Table: adisti_transactions
app.get('/api/adisti', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM adisti_transactions ORDER BY inserted_at DESC LIMIT 5000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/adisti/bulk', async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data)) return res.status(400).json({ message: 'No data provided' });

  const values = data.map(item => [
    item.sn_number, 
    item.warehouse, 
    item.product_name, 
    item.salesforce_name,
    item.tap, 
    item.no_rs, 
    item.id_digipos, 
    item.nama_outlet, 
    item.created_at, // This maps to 'created_at' VARCHAR(50) in your schema (Transaction Date from CSV)
    new Date()       // This maps to 'inserted_at' TIMESTAMP
  ]);

  try {
    await db.query(
      `INSERT INTO adisti_transactions 
      (sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet, created_at, inserted_at) 
      VALUES ?`,
      [values]
    );
    res.json({ message: 'Adisti data imported successfully' });
  } catch (err) {
    console.error('Adisti Import Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. USER MANAGEMENT - Table: users
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, role, name FROM users');
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role, name } = req.body;
    try {
        // Hash password default if not provided
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        await db.query('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', 
            [username, hashedPassword, role, name]);
        res.json({ message: 'User added successfully' });
    } catch(err) {
        // Handle duplicate username error
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { role, name, password } = req.body;
    try {
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE users SET role = ?, name = ?, password = ? WHERE id = ?', 
                [role, name, hashedPassword, req.params.id]);
        } else {
            await db.query('UPDATE users SET role = ?, name = ? WHERE id = ?', 
                [role, name, req.params.id]);
        }
        res.json({ message: 'User updated successfully' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted successfully' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});