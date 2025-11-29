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
// Limit upload size in Node.js app
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// CRITICAL FIX: Serve Static Files from the root 'dist' folder (Vite build output)
app.use(express.static(path.join(__dirname, '../dist')));

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

// Helper: Chunk Array for Batch Inserts
const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

// --- ROUTES ---

// 1. AUTH LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log(`[LOGIN START] User: ${username}`);

  try {
    // Select all columns including new assignments
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
        return res.status(401).json({ message: 'User not found' });
    }

    const user = rows[0];
    const inputPassStr = String(password).trim();
    
    let validPass = false;
    if (user.password.startsWith('$2b$')) {
        validPass = await bcrypt.compare(inputPassStr, user.password);
    } else {
        validPass = inputPassStr === String(user.password);
    }

    if (!validPass) {
        return res.status(401).json({ message: 'Invalid password' });
    }

    const isDefaultPassword = (inputPassStr === '123456');

    console.log(`[LOGIN SUCCESS] User: ${username}`);

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    
    res.json({ 
        token, 
        user: { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            name: user.name, 
            mustChangePassword: isDefaultPassword,
            assigned_salesforce: user.assigned_salesforce,
            assigned_tap: user.assigned_tap
        } 
    });
  } catch (err) {
    console.error('[LOGIN ERROR]:', err);
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

  const chunks = chunkArray(values, 1000);
  let processed = 0;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const chunk of chunks) {
        await connection.query(
          `INSERT IGNORE INTO serial_numbers 
          (sn_number, flag, warehouse, sub_category, product_name, expired_date, status, salesforce_name, tap, price, transaction_id, no_rs, created_at) 
          VALUES ?`, 
          [chunk]
        );
        processed += chunk.length;
    }
    await connection.commit();
    res.json({ message: `Successfully processed ${processed} records.` });
  } catch (err) {
    await connection.rollback();
    console.error('Bulk insert error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

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

  const chunks = chunkArray(values, 1000);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const chunk of chunks) {
        await connection.query(
          `INSERT INTO topup_transactions (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet, created_at) VALUES ?`,
          [chunk]
        );
    }
    await connection.commit();
    res.json({ message: 'Imported' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
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

  const chunks = chunkArray(values, 1000);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const chunk of chunks) {
        await connection.query(
          `INSERT INTO bucket_transactions (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet, created_at) VALUES ?`,
          [chunk]
        );
    }
    await connection.commit();
    res.json({ message: 'Imported' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 6. ADISTI (SERVER SIDE PAGINATION WITH MULTI-SELECT & ROBUST DATE)
app.get('/api/adisti/filters', async (req, res) => {
    try {
        const [sales] = await db.query('SELECT DISTINCT salesforce_name FROM adisti_transactions WHERE salesforce_name IS NOT NULL AND salesforce_name != "" ORDER BY salesforce_name ASC');
        const [taps] = await db.query('SELECT DISTINCT tap FROM adisti_transactions WHERE tap IS NOT NULL AND tap != "" ORDER BY tap ASC');
        res.json({ 
            sales: sales.map(s => s.salesforce_name),
            taps: taps.map(t => t.tap)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/adisti', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    
    const search = req.query.search || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    
    // Salesforce & TAP can be comma separated string if multiple selected
    const salesforce = req.query.salesforce || '';
    const tap = req.query.tap || '';

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
        whereClause += ` AND (sn_number LIKE ? OR product_name LIKE ? OR nama_outlet LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // MULTI-SELECT LOGIC for Salesforce
    if (salesforce && salesforce !== 'all') {
        const sfArray = salesforce.split(',').map(s => s.trim());
        if (sfArray.length > 0) {
            whereClause += ` AND salesforce_name IN (?)`;
            params.push(sfArray);
        }
    }

    // MULTI-SELECT LOGIC for TAP
    if (tap && tap !== 'all') {
        const tapArray = tap.split(',').map(t => t.trim());
        if (tapArray.length > 0) {
            whereClause += ` AND tap IN (?)`;
            params.push(tapArray);
        }
    }

    // ROBUST DATE LOGIC
    // We check both direct string comparison AND str_to_date for DD/MM/YYYY format
    if (startDate) {
        whereClause += ` AND (
            (created_at REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND created_at >= ?) OR 
            (created_at REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND STR_TO_DATE(created_at, '%d/%m/%Y') >= ?)
        )`;
        params.push(startDate, startDate);
    }

    if (endDate) {
        whereClause += ` AND (
            (created_at REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND created_at <= ?) OR 
            (created_at REGEXP '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND STR_TO_DATE(created_at, '%d/%m/%Y') <= ?)
        )`;
        params.push(endDate, endDate);
    }

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM adisti_transactions ${whereClause}`, params);
    const total = countResult[0].total;

    const queryParams = [...params, limit, offset];
    const [rows] = await db.query(`SELECT * FROM adisti_transactions ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`, queryParams);

    res.json({
        data: rows,
        total: total,
        page: page,
        totalPages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error("Adisti Fetch Error:", err);
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

  const chunks = chunkArray(values, 1000);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const chunk of chunks) {
        await connection.query(
          `INSERT INTO adisti_transactions (sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet, created_at, inserted_at) VALUES ?`,
          [chunk]
        );
    }
    await connection.commit();
    res.json({ message: 'Imported' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 7. USERS (UPDATED for Assignments)
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, role, name, assigned_salesforce, assigned_tap FROM users');
        res.json(rows);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role, name, assigned_salesforce, assigned_tap } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password || '123456', 10);
        await db.query(
            'INSERT INTO users (username, password, role, name, assigned_salesforce, assigned_tap) VALUES (?, ?, ?, ?, ?, ?)', 
            [username, hashedPassword, role, name, assigned_salesforce || null, assigned_tap || null]
        );
        res.json({ message: 'User added' });
    } catch(err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username exists' });
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { role, name, password, assigned_salesforce, assigned_tap } = req.body;
    try {
        let query, params;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = 'UPDATE users SET role = ?, name = ?, password = ?, assigned_salesforce = ?, assigned_tap = ? WHERE id = ?';
            params = [role, name, hashedPassword, assigned_salesforce || null, assigned_tap || null, req.params.id];
        } else {
            query = 'UPDATE users SET role = ?, name = ?, assigned_salesforce = ?, assigned_tap = ? WHERE id = ?';
            params = [role, name, assigned_salesforce || null, assigned_tap || null, req.params.id];
        }
        await db.query(query, params);
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

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});