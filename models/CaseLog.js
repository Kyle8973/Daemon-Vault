// models/CaseLog.js
// Schema for logging case events such as file uploads, case open / close, user actions within cases

const mongoose = require('mongoose');

const caseLogSchema = new mongoose.Schema({
    action: { type: String, required: true },
    username: { type: String, default: 'Unknown' },
    ip: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    
    // --- OPTIONAL FIELDS (Used for Evidence) ---
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' }, 
    fileName: { type: String },

    // --- OPTIONAL FIELDS (Used for Cases) ---
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' }, 
    
    details: { type: String }
});

module.exports = mongoose.model('CaseLog', caseLogSchema);