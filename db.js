const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');

// 1. Ensure data directory exists
const dir = path.join(__dirname, 'data');
if (!fs.existsSync(dir)) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Created data directory.');
    } catch (err) {
        console.error('Failed to create data directory:', err);
        process.exit(1);
    }
}

const dbPath = path.join(dir, 'audit_system.db');

// 2. Initialize Database Connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database.');
        initializeDatabase();
    }
});

// 3. Enable Performance Optimizations (WAL Mode)
// This prevents "Database is locked" errors in web apps
db.serialize(() => {
    db.run("PRAGMA journal_mode = WAL;", (err) => {
        if (err) console.error("WAL mode error:", err);
    });
    db.run("PRAGMA synchronous = NORMAL;", (err) => {
        if (err) console.error("Synchronous mode error:", err);
    });
});

// Handle unexpected database errors
db.on('error', (err) => {
    console.error('Unexpected Database Error:', err);
});

function initializeDatabase() {
    db.serialize(() => {
        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('USER', 'AUDITOR')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("Error creating users table:", err);
        });

        // Create Audits Table
        db.run(`CREATE TABLE IF NOT EXISTS audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT,
            assigned_to INTEGER,
            created_by INTEGER NOT NULL,
            config TEXT,
            purchase_data TEXT,
            status TEXT DEFAULT 'PENDING_REVIEW' CHECK(status IN ('PENDING_DATA', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED')),
            admin_notes TEXT,
            submitted_at DATETIME,
            reviewed_at DATETIME,
            reviewed_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(assigned_to) REFERENCES users(id),
            FOREIGN KEY(created_by) REFERENCES users(id),
            FOREIGN KEY(reviewed_by) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error("Error creating audits table:", err);
        });

        // Create Indexes for Performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status)`, (err) => {
            if (err) console.error("Error creating status index:", err);
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_audits_creator ON audits(created_by)`, (err) => {
            if (err) console.error("Error creating creator index:", err);
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_audits_assigned ON audits(assigned_to)`, (err) => {
            if (err) console.error("Error creating assigned index:", err);
        });

        // Seed Data (Async/Await wrapper for safety)
        seedInitialUsers();
    });
}

// 4. Optimized Seeding Logic
// Uses Promises to ensure seeding finishes before the app is fully "ready" logic (if needed)
async function seedInitialUsers() {
    const usersToSeed = [
        { username: 'auditor', password: 'auditor123', role: 'AUDITOR' },
        { username: 'user', password: 'user123', role: 'USER' }
    ];

    for (const user of usersToSeed) {
        await seedUser(user.username, user.password, user.role);
    }
}

function seedUser(username, plainPassword, role) {
    return new Promise((resolve, reject) => {
        // Check if user exists
        db.get("SELECT id FROM users WHERE username = ?", [username], async (err, row) => {
            if (err) {
                console.error(`DB Error checking ${username}:`, err);
                return reject(err);
            }

            if (row) {
                // User exists, skip
                // console.log(`User ${username} already exists.`);
                return resolve();
            }

            // Hash password
            try {
                const hash = await bcrypt.hash(plainPassword, 10);
                
                db.run(
                    "INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, datetime('now'))", 
                    [username, hash, role], 
                    function(err) {
                        if (err) {
                            console.error(`Error seeding ${username}:`, err);
                            return reject(err);
                        }
                        console.log(`Seeded user: ${username} (Role: ${role})`);
                        resolve();
                    }
                );
            } catch (e) {
                console.error(`Bcrypt error for ${username}:`, e);
                reject(e);
            }
        });
    });
}

// Graceful Shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

module.exports = db;