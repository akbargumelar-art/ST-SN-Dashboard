
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'rahasia_app_sn_manager_secure_key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve Static Files (Frontend Production Build)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware Verifikasi Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// 1. AUTH LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = rows[0];
    
    let validPass = false;
    // Support legacy/demo passwords (plain) and production passwords (hashed)
    if (user.password.startsWith('$2b$')) {
        validPass = await bcrypt.compare(password, user.password);
    } else {
        validPass = password === user.password;
    }

    if (!validPass) return res.status(401).json({ message: 'Invalid password' });

    // Check force change password logic (if input password is default '123456')
    const isDefaultPassword = password === '123456';

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    
    res.json({ 
        token, 
        user: { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            name: user.name,
            mustChangePassword: isDefaultPassword
        } 
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Change Password Route
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Password minimal 6 karakter' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        res.json({ message: 'Password berhasil diubah' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. REPORT SN (MASTER)
app.get('/api/serial-numbers', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM serial_numbers ORDER BY created_at DESC LIMIT 10000
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/serial-numbers/bulk', async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ message: 'No data provided' });
  }

  const values = data.map(item => [
    item.sn_number, 
    item.flag || '-', 
    item.warehouse || '-', 
    item.sub_category || '-', 
    item.product_name || '-', 
    item.expired_date || null,
    'Ready', 
    item.salesforce_name || '-', 
    item.tap || '-', 
    0, 
    null, 
    item.no_rs || '-',
    new Date()
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
    res.status(500).json({ error: err.message });
  }
});

// Update Single Status
app.put('/api/serial-numbers/:id/status', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    try {
        await db.query('UPDATE serial_numbers SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Status updated successfully' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. SELLTHRU (UPDATE STATUS BULK)
app.post('/api/serial-numbers/sellthru', async (req, res) => {
  const updates = req.body;
  if (!updates || !Array.isArray(updates)) return res.status(400).json({ message: 'Invalid data format' });

  let success = 0;
  let failed = 0;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of updates) {
      const [result] = await connection.query(
        `UPDATE serial_numbers SET 
         status = 'Sukses ST', id_digipos = ?, nama_outlet = ?, price = ?, transaction_id = ? 
         WHERE sn_number = ?`,
        [item.id_digipos, item.nama_outlet, item.price || 0, item.transaction_id, item.sn_number]
      );
      if (result.affectedRows > 0) success++; else failed++;
    }
    await connection.commit();
    res.json({ success, failed });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 4. TOPUP SALDO
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
  if (!data) return res.status(400).json({ message: 'No data' });
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
    res.json({ message: 'Imported' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. BUCKET TRANSAKSI
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
  if (!data) return res.status(400).json({ message: 'No data' });
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
    res.json({ message: 'Imported' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. ADISTI
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
  if (!data) return res.status(400).json({ message: 'No data' });
  const values = data.map(item => [
    item.sn_number, item.warehouse, item.product_name, item.salesforce_name,
    item.tap, item.no_rs, item.id_digipos, item.nama_outlet, item.created_at, new Date()
  ]);
  try {
    await db.query(
      `INSERT INTO adisti_transactions (sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet, created_at, inserted_at) VALUES ?`,
      [values]
    );
    res.json({ message: 'Imported' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. USERS
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
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        await db.query('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', 
            [username, hashedPassword, role, name]);
        res.json({ message: 'User added' });
    } catch(err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username exists' });
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { role, name, password } = req.body;
    try {
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE users SET role = ?, name = ?, password = ? WHERE id = ?', [role, name, hashedPassword, req.params.id]);
        } else {
            await db.query('UPDATE users SET role = ?, name = ? WHERE id = ?', [role, name, req.params.id]);
        }
        res.json({ message: 'Updated' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all for React Router (Must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
