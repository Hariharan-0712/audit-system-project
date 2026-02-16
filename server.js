const express = require('express');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcrypt');
const session = require('express-session');
const helmet = require('helmet');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------
// FIX: Point static files to the 'public' folder
// ---------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// Define route to serve index.html at the root
app.get('/', (req, res) => {
    // FIX: Load index.html from the 'public' folder
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'audit-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('USER', 'AUDITOR').required()
});

const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    req.user = req.session.user;
    next();
};

// --- ROUTES ---

app.post('/api/register', async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const { username, password, role } = value;
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(`INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, datetime('now'))`, 
            [username, hashedPassword, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: "Username already taken" });
                }
                return res.status(500).json({ error: "Database error" });
            }
            res.status(201).json({ 
                message: "User registered successfully",
                userId: this.lastID
            });
        });
    } catch (err) { 
        res.status(500).json({ error: "Server error" }); 
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Invalid credentials" });
        
        req.session.user = { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        };
        res.json({ 
            message: "Login success", 
            user: req.session.user 
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Could not log out" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out" });
    });
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// GET Audits
app.get('/api/audits', requireAuth, (req, res) => {
    const role = req.user.role;
    const userId = req.user.id;
    
    let query = `SELECT a.*, u.username as auditor_name, creator.username as creator_name
                 FROM audits a 
                 LEFT JOIN users u ON a.assigned_to = u.id
                 LEFT JOIN users creator ON a.created_by = creator.id
                 WHERE 1=1`;
    const params = [];

    if (role === 'USER') {
        query += ` AND a.created_by = ?`;
        params.push(userId);
    } else if (role === 'AUDITOR') {
        query += ` AND a.assigned_to = ?`;
        params.push(userId);
    }
    
    query += ` ORDER BY a.created_at DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const audits = rows.map(a => ({
            ...a,
            config: safeParse(a.config),
            purchase_data: safeParse(a.purchase_data)
        }));
        res.json(audits);
    });
});

// POST Audit (Create Request)
app.post('/api/audits', requireAuth, (req, res) => {
    const { title, type, purchase_data } = req.body;
    
    if (!title || !purchase_data) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const config = { require_purchase_rate: true };
    const status = 'PENDING_REVIEW';
    
    // SMART ASSIGNMENT: Find auditor with least pending tasks
    const assignQuery = `
        SELECT u.id, COUNT(a.id) as pending_count 
        FROM users u 
        LEFT JOIN audits a ON u.id = a.assigned_to AND a.status = 'PENDING_REVIEW'
        WHERE u.role = 'AUDITOR'
        GROUP BY u.id
        ORDER BY pending_count ASC
        LIMIT 1
    `;

    db.get(assignQuery, [], (err, auditor) => {
        if (err) {
            console.error("Error finding auditor:", err);
            return res.status(500).json({ error: "Assignment error" });
        }
        
        if (!auditor) {
            return res.status(400).json({ error: "No auditors available in the system." });
        }

        const assignedTo = auditor.id;

        const sql = `INSERT INTO audits (title, type, assigned_to, created_by, config, purchase_data, status, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            title, 
            type || "Purchase", 
            assignedTo, 
            req.user.id,
            JSON.stringify(config), 
            JSON.stringify(purchase_data),
            status
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Insert Error:", err);
                return res.status(500).json({ error: "Failed to save request" });
            }
            // Get auditor name for notification
            db.get("SELECT username FROM users WHERE id = ?", [assignedTo], (err, auditorInfo) => {
                res.status(201).json({ 
                    id: this.lastID, 
                    message: "Request submitted successfully",
                    assignedTo: assignedTo,
                    assignedToName: auditorInfo ? auditorInfo.username : "Unknown"
                });
            });
        });
    });
});

// PUT Audit (Review/Update)
app.put('/api/audits/:id', requireAuth, (req, res) => {
    const auditId = req.params.id;
    const { status, admin_notes, purchase_data } = req.body;

    db.get("SELECT * FROM audits WHERE id = ?", [auditId], (err, audit) => {
        if (err || !audit) return res.status(404).json({ error: "Audit not found" });

        // AUDITOR FLOW
        if (req.user.role === 'AUDITOR') {
            const nextStatus = status === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
            const sql = `UPDATE audits SET status = ?, admin_notes = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`;
            
            db.run(sql, [nextStatus, admin_notes || "", req.user.id, auditId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // Get user info to notify
                db.get("SELECT u.username FROM users u WHERE u.id = ?", [audit.created_by], (err, userInfo) => {
                    res.json({ 
                        message: `Audit ${nextStatus}`, 
                        status: nextStatus,
                        notifiedUser: userInfo ? userInfo.username : "Unknown"
                    });
                });
            });
        }
        // USER FLOW (Resubmit drafts)
        else if (req.user.role === 'USER' && audit.created_by === req.user.id) {
            const sql = `UPDATE audits SET purchase_data = ?, status = 'PENDING_REVIEW' WHERE id = ?`;
            db.run(sql, [JSON.stringify(purchase_data), auditId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                // Get auditor info to notify
                db.get("SELECT u.username FROM users u WHERE u.id = ?", [audit.assigned_to], (err, auditorInfo) => {
                    res.json({ 
                        message: "Data updated and resubmitted for review",
                        notifiedAuditor: auditorInfo ? auditorInfo.username : "Unknown"
                    });
                });
            });
        } else {
            res.status(403).json({ error: "Permission denied" });
        }
    });
});

function safeParse(str) {
    try {
        return JSON.parse(str || '{}');
    } catch (e) {
        return {};
    }
}

// --- SPA CATCH-ALL ROUTE (Must be last) ---
// FIX: Serve index.html from the 'public' folder
app.get('/*splat', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`--------------------------------------------`));
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
app.listen(PORT, () => console.log(`--------------------------------------------`));
