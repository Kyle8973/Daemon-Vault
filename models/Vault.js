// models/Vault.js
// Mongoose Schema For Encrypted Vault Storage

const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
    encryptedSecret: { type: String, required: true },
    iv: { type: String, required: true }, // Initialisation Vector for AES-GCM
    authTag: { type: String, required: true }, // GCM integrity check
    salt: { type: String, required: true } // For deriving the key
});

module.exports = mongoose.model('Vault', vaultSchema);