// server.js - Main Express Server Setup For Daemon Vault

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('../config/db');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');
const Vault = require('../models/Vault');
const SystemLog = require('../models/SystemLog');
const Logger = require('../utils/Logger');
const chalk = require('chalk');
const time = new Date().toLocaleTimeString('en-GB');
let output = `[${chalk.gray(time)}] `;

// Initialize App
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'javascript')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/dashboard', function (req, res) {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Session
if (!process.env.SESSION_SECRET) {
    console.log(output + `${chalk.red.bold('[SERVER ERROR]')}` + " SESSION_SECRET Is Missing From .env")
    process.exit(1);
}

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// --- VAULT LOGIC ---
const deriveKey = (password, salt) => {
    return crypto.scryptSync(password, salt, 32);
};

async function initializeVault() {
    const existingVault = await Vault.findOne();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (existingVault) {
        return new Promise((resolve, reject) => {
            rl.question(`[${chalk.gray(time)}] ` + `${chalk.red.bold('[SYSTEM LOCKED]')}` + ' Enter Master Key To Unlock: ', (inputKey) => {
                rl.close();
                try {
                    const salt = Buffer.from(existingVault.salt, 'hex');
                    const key = deriveKey(inputKey.trim(), salt);
                    const iv = Buffer.from(existingVault.iv, 'hex');
                    const authTag = Buffer.from(existingVault.authTag, 'hex');
                    const encrypted = Buffer.from(existingVault.encryptedSecret, 'hex');

                    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                    decipher.setAuthTag(authTag);

                    let decrypted = decipher.update(encrypted);
                    decrypted = Buffer.concat([decrypted, decipher.final()]);

                    global.FILE_SECRET = decrypted.toString();
                    Logger.log('SYSTEM_UNLOCK_SUCCESS', { Method: 'Master Key Unlock' });

                    console.clear(); // clear console after successful unlock
                    resolve();
                } catch (err) {
                    Logger.log('SYSTEM_UNLOCK_FAIL', { Error: 'Invalid Key Attempt' });
                    console.error(chalk.red('Invalid Master Key. Exiting...'));
                    process.exit(1);
                }
            });
        });
    } else {
        console.log('\n🚨  INITIAL SETUP DETECTED');
        Logger.log('SYSTEM_INIT', { message: 'New Vault Initialized' });

        const fileSecret = crypto.randomBytes(32).toString('hex').slice(0, 32);
        const unlockKey = crypto.randomBytes(16).toString('hex');

        const salt = crypto.randomBytes(16);
        const key = deriveKey(unlockKey, salt);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(fileSecret, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        await new Vault({
            encryptedSecret: encrypted.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            salt: salt.toString('hex')
        }).save();

        // Display Master Unlock Key
        console.log('\n' + '='.repeat(50));
        console.log('🛑 STOP AND READ THIS CAREFULLY 🛑');
        console.log('Here is your MASTER UNLOCK KEY:');
        console.log(`\n    ${unlockKey}\n`);
        console.log('WRITE THIS DOWN IMMEDIATELY.');
        console.log('YOU HAVE 10 SECONDS TO SAVE THIS KEY BEFORE THE CONSOLE CLEARS');
        console.log('='.repeat(50) + '\n');

        // Wait 10 seconds, then clear console
        await new Promise(r => setTimeout(r, 10000));
        console.clear();

        // Ask user to enter the master key
        await new Promise((resolve) => {
            rl.question('Enter MASTER UNLOCK KEY to proceed: ', (inputKey) => {
                rl.close();
                if (inputKey.trim() !== unlockKey) {
                    Logger.log('SYSTEM_UNLOCK_FAIL', { Error: 'Invalid Key Attempt' });
                    console.error(chalk.red('Invalid Master Key. Exiting...'));
                    process.exit(1);
                }
                global.FILE_SECRET = fileSecret;
                Logger.log('SYSTEM_UNLOCK_SUCCESS', { Method: 'Master Key Unlock' });
                console.clear();
                resolve();
            });
        });
    }
}

// Initialise Vault
(async () => {
    try {
        await connectDB();

        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

        console.log(output += `${chalk.green.bold('[Starting Log Retention Policy]')}`);
        await SystemLog.checkRetention();

        await initializeVault();

        // --- REGISTER ROUTES ---
        app.use('/api', require('../routes/authRoutes'));
        app.use('/api', require('../routes/dashboardRoutes'));
        app.use('/api/cases', require('../routes/caseRoutes'));
        const reportRoutes = require('../routes/reportRoutes');
        app.use('/api/reports', reportRoutes);

        // Serve Frontend
        app.get('/', (req, res) => {
            req.session.userId ?
                res.sendFile(path.join(__dirname, '../public/dashboard.html')) :
                res.sendFile(path.join(__dirname, '../public/login.html'));
        });

        // Start Server
        app.listen(PORT, () => {
            console.clear(); // clear console before showing server status
            Logger.log('SERVER_START', { port: PORT });
        });

        // Error Handling
    } catch (err) {
        console.error('Startup Error:', err);
    }
})();