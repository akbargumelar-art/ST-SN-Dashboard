const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'rahasia_app_sn_manager';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- ROUTES ---

// 1. AUTH LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = rows[0];
    
    // Check password (simple comparison for migration/demo, use bcrypt.compare for production)
    // If password in DB starts with $, assume it's hashed
    let validPass = false;
    if (user.password.startsWith('$')) {
        validPass = await bcrypt.compare(password, user.password);
    } else {
        validPass = password === user.password;
    }

    if (!validPass) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1d' });
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
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. REPORT SN (MASTER)
app.get('/api/serial-numbers', async (req, res) => {
  try {
    // Limit to prevent crashing browser if data is huge, implement pagination in future
    const [rows] = await db.query('SELECT * FROM serial_numbers ORDER BY created_at DESC LIMIT 10000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/serial-numbers/bulk', async (req, res) => {
  const data = req.body; // Expect array of objects
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ message: 'No data provided' });
  }

  const values = data.map(item => [
    item.sn_number, 
    item.flag || '-', 
    item.warehouse || '-', 
    item.sub_category || '-', 
    item.product_name || '-', 
    item.salesforce_name || '-', 
    item.tap || '-', 
    item.no_rs || '-', 
    item.expired_date || null,
    'Ready', 
    new Date()
  ]);

  try {
    await db.query(
      'INSERT IGNORE INTO serial_numbers (sn_number, flag, warehouse, sub_category, product_name, salesforce_name, tap, no_rs, expired_date, status, created_at) VALUES ?', 
      [values]
    );
    res.json({ message: 'Data successfully imported' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. SELLTHRU (UPDATE STATUS)
app.post('/api/serial-numbers/sellthru', async (req, res) => {
  const updates = req.body; // Array of { sn_number, id_digipos, nama_outlet, price, transaction_id }
  
  if (!updates || !Array.isArray(updates)) return res.status(400).json({ message: 'Invalid data' });

  let success = 0;
  let failed = 0;

  // Transaction for consistency
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of updates) {
      const [result] = await connection.query(
        `UPDATE serial_numbers SET 
         status = 'Sukses ST', 
         id_digipos = ?, 
         nama_outlet = ?, 
         price = ?, 
         transaction_id = ? 
         WHERE sn_number = ?`,
        [item.id_digipos, item.nama_outlet, item.price || 0, item.transaction_id, item.sn_number]
      );
      
      if (result.affectedRows > 0) {
        success++;
      } else {
        failed++;
      }
    }

    await connection.commit();
    res.json({ success, failed });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 4. TOPUP SALDO
app.get('/api/topup', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM topup_transactions ORDER BY transaction_date DESC LIMIT 5000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/topup/bulk', async (req, res) => {
  const data = req.body;
  const values = data.map(item => [
    item.transaction_date, item.sender, item.receiver, item.transaction_type,
    item.amount, item.currency, item.remarks, item.salesforce, item.tap,
    item.id_digipos, item.nama_outlet, new Date()
  ]);
  
  try {
    await db.query(
      `INSERT INTO topup_transactions (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet, created_at) VALUES ?`,
      [values]
    );
    res.json({ message: 'Topup data imported' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. BUCKET TRANSAKSI
app.get('/api/bucket', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM bucket_transactions ORDER BY transaction_date DESC LIMIT 5000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bucket/bulk', async (req, res) => {
  const data = req.body;
  const values = data.map(item => [
    item.transaction_date, item.sender, item.receiver, item.transaction_type,
    item.amount, item.currency, item.remarks, item.salesforce, item.tap,
    item.id_digipos, item.nama_outlet, new Date()
  ]);
  
  try {
    await db.query(
      `INSERT INTO bucket_transactions (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet, created_at) VALUES ?`,
      [values]
    );
    res.json({ message: 'Bucket data imported' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. LIST SN ADISTI
app.get('/api/adisti', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM adisti_transactions ORDER BY created_at DESC LIMIT 5000');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/adisti/bulk', async (req, res) => {
  const data = req.body;
  const values = data.map(item => [
    item.sn_number, item.warehouse, item.product_name, item.salesforce_name,
    item.tap, item.no_rs, item.id_digipos, item.nama_outlet, item.created_at
  ]);

  try {
    await db.query(
      'INSERT INTO adisti_transactions (sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet, created_at) VALUES ?',
      [values]
    );
    res.json({ message: 'Adisti data imported' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. USER MANAGEMENT
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
        // Hash password default
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        await db.query('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', 
            [username, hashedPassword, role, name]);
        res.json({ message: 'User added' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { role, name } = req.body;
    try {
        await db.query('UPDATE users SET role = ?, name = ? WHERE id = ?', [role, name, req.params.id]);
        res.json({ message: 'User updated' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});