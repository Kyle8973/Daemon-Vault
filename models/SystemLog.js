// models/SystemLog.js
// Schema for logging system events such as master key unlock, server startup, user login / logout with configurable retention policy

const mongoose = require('mongoose');

// Read setting from .env
const retentionSeconds = parseInt(process.env.LOG_RETENTION_SECONDS) || 0;

const systemLogSchema = new mongoose.Schema({
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// --- SMART INDEX MANAGER ---
// We attach this function to the model so server.js can call it
systemLogSchema.statics.checkRetention = async function() {
    try {
        const collection = this.collection;
        const indexes = await collection.indexes();
        
        // Look for the specific index named "createdAt_1"
        const existingIndex = indexes.find(idx => idx.name === 'createdAt_1');
        const currentExpiry = existingIndex ? existingIndex.expireAfterSeconds : null;

        // SCENARIO 1: .env wants retention (e.g., 60s), but DB has NO index
        if (retentionSeconds > 0 && !existingIndex) {
            await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: retentionSeconds });
            console.log(`[SystemLog] 🆕 Retention policy enabled: Auto-delete after ${retentionSeconds}s.`);
        }

        // SCENARIO 2: .env wants retention, but the time has CHANGED
        else if (retentionSeconds > 0 && existingIndex && currentExpiry !== retentionSeconds) {
            console.log(`[SystemLog] 🔄 Updating retention time from ${currentExpiry}s to ${retentionSeconds}s...`);
            
            // 1. Drop the old index
            await collection.dropIndex('createdAt_1');

            // 2. If new time is SHORTER (e.g. 1 hour -> 1 minute), we must manually clean up old logs NOW
            // because Mongo won't instantly catch them all.
            if (retentionSeconds < currentExpiry) {
                const cutoff = new Date(Date.now() - (retentionSeconds * 1000));
                const result = await this.deleteMany({ createdAt: { $lt: cutoff } });
                console.log(`[SystemLog] 🧹 Pruned ${result.deletedCount} old logs to match new shorter limit.`);
            }

            // 3. Create the new index
            await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: retentionSeconds });
        }

        // SCENARIO 3: .env says "Keep Forever" (0), but DB has an index -> DELETE IT
        else if (retentionSeconds <= 0 && existingIndex) {
            await collection.dropIndex('createdAt_1');
            console.log('[SystemLog] ♾️ Retention disabled. Logs will be kept forever.');
        }

    } catch (err) {
        console.error('[SystemLog] ⚠️ Failed to sync retention policy:', err.message);
    }
};

module.exports = mongoose.model('SystemLog', systemLogSchema);