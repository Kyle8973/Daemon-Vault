// routes/dashboardRoutes.js
// Express Routes For Dashboard Data

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const mongoose = require('mongoose');

const isAuthenticated = require('../middleware/auth');
const Image = require('../models/File');
const CaseLog = require('../models/CaseLog');
const Case = require('../models/Case');
const Logger = require('../utils/Logger');

const IV_LENGTH = 16;
const uploadDir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// --- PERMISSION HELPER ---
async function checkCaseAccess(caseId, userId, requiredAction) {
    if (!mongoose.Types.ObjectId.isValid(caseId)) return false;
    const kase = await Case.findById(caseId);
    if (!kase) return false;

    const userIdStr = userId.toString();
    const ownerIdStr = kase.owner.toString();

    if (ownerIdStr === userIdStr) return true;

    const member = kase.members.find(m => m.user.toString() === userIdStr);
    if (!member) return false;

    if (requiredAction === 'read') return true;
    if (requiredAction === 'write') return ['contributor', 'manager'].includes(member.role);
    if (requiredAction === 'delete') return member.role === 'manager';

    return false;
}

// --- ROUTES ---

// 1. UPLOAD
router.post('/upload', isAuthenticated, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No File Uploaded' });

    const { caseId } = req.body;

    const canUpload = await checkCaseAccess(caseId, req.session.userId, 'write');
    if (!canUpload) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Permission Denied' });
    }

    try {
        const tempPath = req.file.path;
        const readStream = fs.createReadStream(tempPath);
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', global.FILE_SECRET, iv);
        const hashAlgo = crypto.createHash('sha256');

        const tempPathEncrypted = tempPath + '.enc';
        const writeStream = fs.createWriteStream(tempPathEncrypted);

        writeStream.write(iv);
        readStream.on('data', (chunk) => hashAlgo.update(chunk));

        readStream.pipe(cipher).pipe(writeStream).on('finish', async () => {
            const fileHash = hashAlgo.digest('hex');
            fs.unlinkSync(tempPath);
            fs.renameSync(tempPathEncrypted, tempPath);

            const image = new Image({
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                owner: req.session.userId,
                caseId: caseId,
                hash: fileHash
            });
            await image.save();

            const userIp = req.ip || req.connection.remoteAddress || 'Unknown';

            // 1. Save to CaseLog (Database)
            await CaseLog.create({
                action: 'File Uploaded',
                username: req.session.username,
                ip: userIp,
                caseId: caseId,       // Linked to Case
                imageId: image._id,   // Linked to Image
                fileName: req.file.originalname,
                details: `File: ${req.file.originalname} | Size: ${(req.file.size / 1024).toFixed(2)} KB | Uploaded By ${req.session.username}`,
                timestamp: new Date()
            });

            // 2. Log to Console
            Logger.log('FILE_UPLOAD', {
                username: req.session.username,
                caseId,
                fileName: req.file.originalname,
                size: req.file.size,
                ip: userIp
            });

            res.json(image);
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Upload Failed' });
    }
});

// 2. LIST IMAGES
router.get('/images', isAuthenticated, async (req, res) => {
    const { caseId } = req.query;
    if (!caseId) return res.json([]);

    const canRead = await checkCaseAccess(caseId, req.session.userId, 'read');
    if (!canRead) return res.status(403).json({ message: 'Access Denied' });

    try {
        const images = await Image.find({ caseId }).sort({ uploadDate: -1 }).populate('owner', 'username');
        res.json(images);
    } catch (err) {
        res.status(500).json({ message: 'Error Fetching Images' });
    }
});

// 3. DELETE
router.delete('/image/:id', isAuthenticated, async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) return res.status(404).json({ message: 'Image not found' });

        const canDelete = await checkCaseAccess(image.caseId, req.session.userId, 'delete');
        if (!canDelete) return res.status(403).json({ message: 'Permission Denied' });

        const filePath = path.join(uploadDir, image.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // --- CHANGED: Do NOT delete old logs. Keep them for audit history. ---
        // await CaseLog.deleteMany({ imageId: image._id }); 

        const userIp = req.ip || req.connection.remoteAddress || 'Unknown';

        // 1. Log Deletion to CaseLog
        await CaseLog.create({
            action: 'File Deleted',
            username: req.session.username,
            ip: userIp,
            caseId: image.caseId, // Still linked to the case
            fileName: image.originalName, // Preserve name since object is gone
            details: `File ${image.originalName} | Size: ${(image.size / 1024).toFixed(2)} KB | Deleted By User: ${req.session.username}`,
            timestamp: new Date()
        });

        // 2. Remove Image Record
        await Image.deleteOne({ _id: image._id });

        // 3. Log to Console
        Logger.log('FILE_DELETED', {
            username: req.session.username,
            fileName: image.originalName,
            ip: userIp
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Delete failed' });
    }
});

// 4. METADATA
router.get('/meta/:id', isAuthenticated, async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) return res.status(404).json({ message: 'Not found' });

        const canRead = await checkCaseAccess(image.caseId, req.session.userId, 'read');
        if (!canRead) return res.status(403).json({ message: 'Access Denied' });

        res.json({
            originalName: image.originalName,
            uploadDate: image.uploadDate,
            size: image.size,
            hash: image.hash,
            caseId: image.caseId
        });
    } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// 5. VERIFY (Generates Token)
router.post('/verify/:id', isAuthenticated, async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) return res.status(404).json({ message: 'Not Found' });

        const canRead = await checkCaseAccess(image.caseId, req.session.userId, 'read');
        if (!canRead) return res.status(403).json({ message: 'Access Denied' });

        const filePath = path.join(uploadDir, image.filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing' });

        const fileBuffer = fs.readFileSync(filePath);
        const iv = fileBuffer.subarray(0, IV_LENGTH);
        const encryptedText = fileBuffer.subarray(IV_LENGTH);
        const decipher = crypto.createDecipheriv('aes-256-cbc', global.FILE_SECRET, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        const currentHash = crypto.createHash('sha256').update(decrypted).digest('hex');
        const isMatch = (currentHash === image.hash);

        const userIp = req.ip || req.connection.remoteAddress || 'Unknown';

        await CaseLog.create({
            imageId: image._id,
            caseId: image.caseId, // Added CaseID linkage
            action: 'File Hash Checked',
            fileName: image.originalName,
            username: req.session.username,
            ip: userIp,
            details: isMatch ? `File: ${image.originalName} | Result: PASS` : `File: ${image.originalName} | Result: FAIL`,
            timestamp: new Date()
        });

        let accessToken = null;
        if (isMatch) {
            accessToken = crypto.randomBytes(16).toString('hex');
            req.session.viewToken = {
                id: image._id.toString(),
                val: accessToken,
                expires: Date.now() + 30000
            };
        }

        res.json({ verified: isMatch, storedHash: image.hash, currentHash: currentHash, token: accessToken });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
});

// 6. VIEW (Requires Token / Protects Preview)
router.get('/view/:id', isAuthenticated, async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) return res.status(404).send('Not Found');

        const canRead = await checkCaseAccess(image.caseId, req.session.userId, 'read');
        if (!canRead) return res.status(403).send('Access Denied');

        const filePath = path.join(uploadDir, image.filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('File Missing');

        if (req.query.preview === 'true') {
            const fetchDest = req.headers['sec-fetch-dest'];
            if (fetchDest === 'document' || fetchDest === 'frame') {
                return res.status(403).send("⛔ ACCESS DENIED: Direct thumbnail access is blocked.");
            }
        } else {
            const serverToken = req.session.viewToken;
            const clientToken = req.query.token;

            if (!serverToken ||
                serverToken.id !== req.params.id ||
                serverToken.val !== clientToken ||
                Date.now() > serverToken.expires
            ) {
                return res.status(403).send("⛔ ACCESS DENIED: You must run 'Verify Integrity' first.");
            }

            req.session.viewToken = null;
            const userIp = req.ip || req.connection.remoteAddress || 'Unknown';

            await CaseLog.create({
                imageId: image._id,
                caseId: image.caseId,
                action: 'VIEW',
                fileName: image.originalName,
                username: req.session.username,
                ip: userIp,
                details: 'Decrypted Via Secure Token',
                timestamp: new Date()
            });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const iv = fileBuffer.subarray(0, IV_LENGTH);
        const encryptedText = fileBuffer.subarray(IV_LENGTH);
        const decipher = crypto.createDecipheriv('aes-256-cbc', global.FILE_SECRET, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        res.setHeader('Content-Type', image.mimeType);
        res.setHeader('Content-Disposition', 'inline');
        res.send(decrypted);

    } catch (err) {
        console.error(err);
        res.status(500).send('Error reading file');
    }
});

// LOGS
router.get('/logs/:id', isAuthenticated, async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) return res.status(404).json({ message: 'Not found' });

        const canRead = await checkCaseAccess(image.caseId, req.session.userId, 'read');
        if (!canRead) return res.status(403).json({ message: 'Access Denied' });

        const logs = await CaseLog.find({ imageId: req.params.id }).sort({ timestamp: -1 });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching logs' });
    }
});

module.exports = router;