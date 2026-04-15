// models/LoginAttempt.js
// Schema for tracking login attempts by IP address to prevent brute-force attacks

const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    firstAttemptTime: { type: Number, default: Date.now },
    blockedUntil: { type: Number, default: 0 },
    
    // Auto-delete this document 1 hour after it was last updated
    // This prevents the DB from filling up with old IP addresses
    updatedAt: { type: Date, default: Date.now, expires: 3600 } 
});

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);