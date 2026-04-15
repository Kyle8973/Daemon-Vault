// models/Case.js
// Schema for managing Cases with Access Control Lists (ACLs)

const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    caseID: { type: String, required: true, unique: true, required: true }, // e.g., "CASE-2026-001"
    name: { type: String, required: true, required: true },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Active' }, // Active, Archived, Closed
    
    // Access Control List (ACL)
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: String,
        role: { 
            type: String, 
            enum: ['viewer', 'contributor', 'manager'], 
            default: 'viewer' 
        }
    }]
});

/* ROLES EXPLAINED:
- 'viewer': Read Only
- 'contributor': Read + Upload
- 'manager': Read + Upload + Delete
(Owner has full access by default)
*/

module.exports = mongoose.model('Case', caseSchema);