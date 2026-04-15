// models/File.js
// Schema for storing files with association to Cases

const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    // ... (Keep existing fields: filename, originalName, hash, etc.) ...
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    hash: { type: String, required: true },
    
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who uploaded it
    
    // --- NEW FIELD ---
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    
    uploadDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', imageSchema);