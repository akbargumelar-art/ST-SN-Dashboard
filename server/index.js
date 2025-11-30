const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'sn_manager_secret_key_123';

// Middleware to verify Token
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

// --- AUTH ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(400).json({ message: 'User not found' });

        const user = users[0];
        // Check hardcoded password for initial setup if hash fails (fallback) or use bcrypt
        const match = await bcrypt.compare(password, user.password);
        // Simple fallback for plain text '123456' if not hashed yet in DB manually
        const isDefaultPass = password === user.password; 
        
        if (!match && !isDefaultPass) return res.status(400).json({ message: 'Invalid password' });

        // Check if user needs to change password (e.g. default '123456')
        const mustChangePassword = password === '123456';

        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '12h' });
        
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role, 
                name: user.name,
                mustChangePassword,
                assigned_salesforce: user.assigned_salesforce,
                assigned_tap: user.assigned_tap
            } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- USERS ---
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.sendStatus(403);
    try {
        const [rows] = await db.query('SELECT id, username, role, name, assigned_salesforce, assigned_tap FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.sendStatus(403);
    const { username, password, role, name, assigned_salesforce, assigned_tap } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password, role, name, assigned_salesforce, assigned_tap) VALUES (?, ?, ?, ?, ?, ?)', 
            [username, hashedPassword, role, name, assigned_salesforce || null, assigned_tap || null]
        );
        res.json({ message: 'User created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.sendStatus(403);
    const { username, role, name, assigned_salesforce, assigned_tap } = req.body;
    try {
        await db.query(
            'UPDATE users SET username=?, role=?, name=?, assigned_salesforce=?, assigned_tap=? WHERE id=?', 
            [username, role, name, assigned_salesforce || null, assigned_tap || null, req.params.id]
        );
        res.json({ message: 'User updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.sendStatus(403);
    try {
        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SERIAL NUMBERS ---
app.get('/api/serial-numbers', authenticateToken, async (req, res) => {
    try {
        // Simple fetch all (optimize later with pagination if needed for this endpoint)
        // For Dashboard & Sellthru, we usually need recent data
        const [rows] = await db.query('SELECT * FROM serial_numbers ORDER BY created_at DESC LIMIT 5000');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/serial-numbers/bulk', authenticateToken, async (req, res) => {
    const items = req.body; // Array of objects
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'No data provided' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO serial_numbers 
            (sn_number, flag, warehouse, sub_category, product_name, expired_date, salesforce_name, tap, no_rs) 
            VALUES ? 
            ON DUPLICATE KEY UPDATE 
            flag=VALUES(flag), warehouse=VALUES(warehouse), sub_category=VALUES(sub_category), 
            product_name=VALUES(product_name), salesforce_name=VALUES(salesforce_name), tap=VALUES(tap), no_rs=VALUES(no_rs)
        `;
        const values = items.map(i => [
            i.sn_number, i.flag, i.warehouse, i.sub_category, i.product_name, i.expired_date, i.salesforce_name, i.tap, i.no_rs
        ]);
        
        await connection.query(query, [values]);
        await connection.commit();
        res.json({ message: 'Bulk upload successful' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.put('/api/serial-numbers/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    try {
        await db.query('UPDATE serial_numbers SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/serial-numbers/sellthru', authenticateToken, async (req, res) => {
    const items = req.body; // [{ sn_number, id_digipos, nama_outlet, price, transaction_id }]
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const item of items) {
            await connection.query(
                `UPDATE serial_numbers 
                 SET status = 'Sukses ST', id_digipos = ?, nama_outlet = ?, price = ?, transaction_id = ? 
                 WHERE sn_number = ?`,
                [item.id_digipos, item.nama_outlet, item.price, item.transaction_id, item.sn_number]
            );
        }
        await connection.commit();
        res.json({ message: 'Sellthru updated' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// --- TOPUP & BUCKET ---
app.get('/api/topup', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM topup_transactions ORDER BY created_at DESC LIMIT 2000');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/topup/bulk', authenticateToken, async (req, res) => {
    const items = req.body;
    try {
        const query = `INSERT INTO topup_transactions (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet) VALUES ?`;
        const values = items.map(i => [i.transaction_date, i.sender, i.receiver, i.transaction_type, i.amount, i.currency, i.remarks, i.salesforce, i.tap, i.id_digipos, i.nama_outlet]);
        await db.query(query, [values]);
        res.json({ message: 'Topup uploaded' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bucket', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM bucket_transactions ORDER BY created_at DESC LIMIT 2000');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bucket/bulk', authenticateToken, async (req, res) => {
    const items = req.body;
    try {
        const query = `INSERT INTO bucket_transactions (transaction_date, sender, receiver, transaction_type, amount, currency, remarks, salesforce, tap, id_digipos, nama_outlet) VALUES ?`;
        const values = items.map(i => [i.transaction_date, i.sender, i.receiver, i.transaction_type, i.amount, i.currency, i.remarks, i.salesforce, i.tap, i.id_digipos, i.nama_outlet]);
        await db.query(query, [values]);
        res.json({ message: 'Bucket uploaded' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADISTI (LIST SN) ---
app.post('/api/adisti/bulk', authenticateToken, async (req, res) => {
    const items = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO adisti_transactions 
            (created_at, sn_number, warehouse, product_name, salesforce_name, tap, no_rs, id_digipos, nama_outlet) 
            VALUES ?
        `;
        const values = items.map(i => [
            i.created_at, i.sn_number, i.warehouse, i.product_name, i.salesforce_name, i.tap, i.no_rs, i.id_digipos, i.nama_outlet
        ]);
        await connection.query(query, [values]);
        await connection.commit();
        res.json({ message: 'Adisti data uploaded' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// Get Filter Options (Distinct)
app.get('/api/adisti/filters', async (req, res) => {
    try {
        const selectedTap = req.query.tap; 

        // Get Taps
        const [tapRows] = await db.query('SELECT DISTINCT tap FROM adisti_transactions WHERE tap IS NOT NULL AND tap != "" ORDER BY tap');
        const taps = tapRows.map(r => r.tap);

        // Get Sales (Filtered by TAP if provided)
        let salesQuery = 'SELECT DISTINCT salesforce_name FROM adisti_transactions WHERE salesforce_name IS NOT NULL AND salesforce_name != ""';
        let salesParams = [];
        
        if (selectedTap) {
            const tapArray = selectedTap.split(',').map(t => t.trim());
            if (tapArray.length > 0) {
                 salesQuery += ' AND tap IN (?)';
                 salesParams.push(tapArray);
            }
        }
        salesQuery += ' ORDER BY salesforce_name';

        const [salesRows] = await db.query(salesQuery, salesParams);
        const sales = salesRows.map(r => r.salesforce_name);

        res.json({ sales, taps });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Main Adisti Endpoint (Pagination, Filtering, Sorting)
app.get('/api/adisti', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // DEFAULT 50
        const offset = (page - 1) * limit;

        const search = req.query.search || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const salesforce = req.query.salesforce || '';
        const tap = req.query.tap || '';
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ` AND (sn_number LIKE ? OR product_name LIKE ? OR nama_outlet LIKE ? OR id_digipos LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Multi-select for Salesforce
        if (salesforce && salesforce !== 'all') {
             const sfArray = salesforce.split(',').map(s => s.trim());
             if (sfArray.length > 0) {
                 whereClause += ` AND salesforce_name IN (?)`;
                 params.push(sfArray);
             }
        }
        
        // Multi-select for TAP
        if (tap && tap !== 'all') {
             const tapArray = tap.split(',').map(t => t.trim());
             if (tapArray.length > 0) {
                 whereClause += ` AND tap IN (?)`;
                 params.push(tapArray);
             }
        }

        // Robust Date Filter (Handle ISO and DD/MM/YYYY)
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

        // Count Total
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM adisti_transactions ${whereClause}`, params);
        const total = countResult[0].total;

        // Get Data
        const query = `
            SELECT * FROM adisti_transactions 
            ${whereClause} 
            ORDER BY ${sortBy} ${sortOrder} 
            LIMIT ? OFFSET ?
        `;
        // Flatten params for the main query because of the IN clauses inside whereClause
        // Note: mysql2 handles array parameters for IN (?) automatically if passed as a single element in params array
        const [rows] = await db.query(query, [...params, limit, offset]);

        res.json({
            data: rows,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {
        console.error("Adisti API Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Adisti Export CSV Endpoint
app.get('/api/adisti/export', async (req, res) => {
    try {
        const search = req.query.search || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const salesforce = req.query.salesforce || '';
        const tap = req.query.tap || '';
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
             whereClause += ` AND (sn_number LIKE ? OR product_name LIKE ? OR nama_outlet LIKE ? OR id_digipos LIKE ?)`;
             params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (salesforce && salesforce !== 'all') {
             const sfArray = salesforce.split(',').map(s => s.trim());
             if (sfArray.length > 0) {
                 whereClause += ` AND salesforce_name IN (?)`;
                 params.push(sfArray);
             }
        }
        if (tap && tap !== 'all') {
             const tapArray = tap.split(',').map(t => t.trim());
             if (tapArray.length > 0) {
                 whereClause += ` AND tap IN (?)`;
                 params.push(tapArray);
             }
        }
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

        const query = `SELECT * FROM adisti_transactions ${whereClause} ORDER BY ${sortBy} ${sortOrder}`;
        const [rows] = await db.query(query, params);

        // Generate CSV
        const headers = ['created_at', 'sn_number', 'warehouse', 'product_name', 'salesforce_name', 'tap', 'no_rs', 'id_digipos', 'nama_outlet'];
        const csvRows = [headers.join(',')];
        
        rows.forEach(row => {
            const values = headers.map(header => {
                const val = row[header] ? String(row[header]).replace(/"/g, '""') : '';
                return `"${val}"`;
            });
            csvRows.push(values.join(','));
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`adisti_export_${new Date().toISOString()}.csv`);
        return res.send(csvRows.join('\n'));

    } catch (err) {
        console.error("Export Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Adisti Summary Tree Endpoint
app.get('/api/adisti/summary-tree', async (req, res) => {
    try {
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const search = req.query.search || '';
        const salesforce = req.query.salesforce || '';
        const tap = req.query.tap || '';

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
             whereClause += ` AND (sn_number LIKE ? OR product_name LIKE ? OR nama_outlet LIKE ?)`;
             params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        if (salesforce && salesforce !== 'all') {
             const sfArray = salesforce.split(',').map(s => s.trim());
             if (sfArray.length > 0) {
                 whereClause += ` AND salesforce_name IN (?)`;
                 params.push(sfArray);
             }
        }
        if (tap && tap !== 'all') {
             const tapArray = tap.split(',').map(t => t.trim());
             if (tapArray.length > 0) {
                 whereClause += ` AND tap IN (?)`;
                 params.push(tapArray);
             }
        }

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

        const query = `
            SELECT 
                COALESCE(tap, 'Unknown') as tap, 
                COALESCE(salesforce_name, 'Unknown') as salesforce, 
                COALESCE(product_name, 'Unknown') as product, 
                COUNT(*) as count 
            FROM adisti_transactions 
            ${whereClause} 
            GROUP BY tap, salesforce_name, product_name 
            ORDER BY tap, salesforce_name, count DESC
        `;
        
        const [rows] = await db.query(query, params);

        // Transform to Tree
        const tree = {};
        rows.forEach(row => {
            if (!tree[row.tap]) {
                tree[row.tap] = { name: row.tap, total: 0, salesforces: {} };
            }
            tree[row.tap].total += row.count;

            if (!tree[row.tap].salesforces[row.salesforce]) {
                tree[row.tap].salesforces[row.salesforce] = { name: row.salesforce, total: 0, products: [] };
            }
            tree[row.tap].salesforces[row.salesforce].total += row.count;
            tree[row.tap].salesforces[row.salesforce].products.push({
                name: row.product,
                total: row.count // renamed from 'count' to 'total' for consistency
            });
        });

        // Flatten to array
        const result = Object.values(tree).map(t => ({
            name: t.name,
            total: t.total,
            children: Object.values(t.salesforces).map(s => ({
                name: s.name,
                total: s.total,
                children: s.products
            })).sort((a, b) => b.total - a.total)
        })).sort((a, b) => b.total - a.total);

        res.json(result);

    } catch (err) {
        console.error("Summary Tree Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Adisti Product Summary Endpoint
app.get('/api/adisti/summary-products', async (req, res) => {
    try {
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';
        const search = req.query.search || '';
        const salesforce = req.query.salesforce || '';
        const tap = req.query.tap || '';

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
             whereClause += ` AND (sn_number LIKE ? OR product_name LIKE ? OR nama_outlet LIKE ?)`;
             params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        if (salesforce && salesforce !== 'all') {
             const sfArray = salesforce.split(',').map(s => s.trim());
             if (sfArray.length > 0) {
                 whereClause += ` AND salesforce_name IN (?)`;
                 params.push(sfArray);
             }
        }
        if (tap && tap !== 'all') {
             const tapArray = tap.split(',').map(t => t.trim());
             if (tapArray.length > 0) {
                 whereClause += ` AND tap IN (?)`;
                 params.push(tapArray);
             }
        }

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

        const query = `
            SELECT 
                COALESCE(product_name, 'Unknown') as product_name, 
                COUNT(*) as total 
            FROM adisti_transactions 
            ${whereClause} 
            GROUP BY product_name 
            ORDER BY total DESC
        `;
        
        const [rows] = await db.query(query, params);
        res.json(rows);

    } catch (err) {
        console.error("Summary Product Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});