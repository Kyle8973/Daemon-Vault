// routes/authRoutes.js
// Express Routes For User Authentication (Register/Login/Logout)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');
const Logger = require('../utils/Logger');

// --- NEW ROUTE: AUTH SETTINGS (Used by Frontend) ---
router.get('/auth-settings', (req, res) => {
    // Returns true unless you explicitly set DISABLE_REGISTRATION=true in .env
    res.json({
        registrationEnabled: process.env.DISABLE_REGISTRATION !== 'true'
    });
});

router.get('/status', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    try {
        const attempt = await LoginAttempt.findOne({ ip });
        const now = Date.now();

        if (attempt && attempt.blockedUntil > 0 && now > attempt.blockedUntil) {
            return res.json({ blocked: false });
        }

        if (attempt && attempt.blockedUntil > now) {
            const remainingMs = attempt.blockedUntil - now;
            const minutesLeft = Math.ceil(remainingMs / 60000);

            return res.json({
                blocked: true,
                remaining: minutesLeft
            });
        }

        res.json({ blocked: false });
    } catch (err) {
        res.status(500).json({ error: "Status Check Failed" });
    }
});

// --- REGISTER ---
router.post('/register', async (req, res) => {
    // 1. SECURITY LOCK: Check if registration is disabled in .env
    if (process.env.DISABLE_REGISTRATION === 'true') {
        Logger.log('REGISTER_FAIL', { reason: 'Registration Disabled by Admin' });
        return res.status(403).json({ error: "Registration is currently disabled." });
    }

    const { username, password } = req.body;
    try {
        if (await User.findOne({ username })) {
            Logger.log('REGISTER_FAIL', { username, reason: 'Username Taken' });
            return res.status(400).json({ error: "Account Registration Failed: Username Taken" });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(password, salt, 64).toString('hex');
        const finalPassword = `${hash}:${salt}`;

        const newUser = new User({ username, password: finalPassword });
        await newUser.save();

        Logger.log('USER_REGISTERED', { username, userId: newUser._id });

        // 2. CHANGE: Removed 'req.session.userId = ...' to prevent auto-login.
        // This forces the user to log in manually, ensuring username is set in session.

        res.json({ message: "Account Registration Successful - Please Login" });

    } catch (err) {
        console.error("Register Error:", err);
        Logger.log('REGISTER_ERROR', { error: err.message });
        res.status(500).json({ error: "Unable To Complete Account Registration, Please Try Again" });
    }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const maxAttempts = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 5;
    const blockMs = (parseInt(process.env.RATE_LIMIT_BLOCK_MINUTES) || 30) * 60 * 1000;

    try {
        let attempt = await LoginAttempt.findOne({ ip });
        if (!attempt) attempt = new LoginAttempt({ ip });

        const now = Date.now();

        // RESET if the block time has passed
        if (attempt.blockedUntil > 0 && now > attempt.blockedUntil) {
            attempt.count = 0;
            attempt.blockedUntil = 0;
        }

        // Block check
        if (attempt.blockedUntil > now) {
            const minutesLeft = Math.ceil((attempt.blockedUntil - now) / 60000);
            Logger.log('LOGIN_BLOCKED', { username, ip, reason: 'Rate Limit Active' });
            return res.status(429).json({ error: `Your IP Has Been Temporarily Blocked: Rate Limits \n\n Try Again In ${minutesLeft} Minutes` });
        }

        const user = await User.findOne({ username });
        let isMatch = false;

        if (user && user.password.includes(':')) {
            const [storedHash, storedSalt] = user.password.split(':');
            const attemptHash = crypto.scryptSync(password, storedSalt, 64).toString('hex');
            if (storedHash === attemptHash) isMatch = true;
        }

        if (!isMatch) {
            attempt.count += 1;
            attempt.updatedAt = now;

            if (attempt.count >= maxAttempts) {
                attempt.blockedUntil = now + blockMs;
                await attempt.save();

                const blockMinutes = Math.round(blockMs / 60000);
                Logger.log('LOGIN_BLOCKED', { username, ip, attempts: attempt.count });

                return res.status(429).json({
                    error: `Your IP Has Been Temporarily Blocked: Rate Limits \n\n Try Again In ${blockMinutes} Minutes`,
                    blockedUntil: attempt.blockedUntil
                });
            }

            await attempt.save();
            const remaining = maxAttempts - attempt.count;

            Logger.log('LOGIN_FAIL', {
                username,
                ip,
                reason: 'Invalid Username / Password',
                remainingAttempts: remaining
            });

            return res.status(401).json({
                error: `Invalid Username Or Password - ${remaining} Attempts Remaining`
            });
        }

        // Wipe record on successful login
        await LoginAttempt.deleteOne({ ip });

        // --- SUCCESS ---
        // This is where we set the session correctly for the Logger to see later
        req.session.userId = user._id;
        req.session.username = user.username;

        Logger.log('LOGIN_SUCCESS', { userId: user._id, username, ip });
        res.json({ message: "Login Successful" });

    } catch (err) {
        Logger.log('LOGIN_ERROR', { error: err.message });
        res.status(500).json({ error: "Server Error" });
    }
});


// --- LOGOUT ROUTE ---
router.get('/logout', (req, res) => {
    // Capture details before destroying session
    const { userId, username } = req.session;
    const ip = req.ip || req.connection.remoteAddress;

    req.session.destroy(err => {
        if (err) return res.status(500).send('Error Logging Out');

        // Now 'username' will be defined because we forced them to use /login
        if (userId) {
            Logger.log('LOGOUT', { userId, username, ip });
        }
        res.redirect('/');
    });
});

module.exports = router;