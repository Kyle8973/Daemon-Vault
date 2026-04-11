// routes/caseRoutes.js
// Express Routes For Case Management (Create/View/Invite/Delete)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Models
const Case = require('../models/Case');
const User = require('../models/User');
const Image = require('../models/File');
const CaseLog = require('../models/CaseLog');
const Logger = require('../utils/Logger');
const isAuthenticated = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');

// 1. LIST ALL CASES
router.get('/list', isAuthenticated, async (req, res) => {
    try {
        const myCases = await Case.find({ owner: req.session.userId }).sort({ createdDate: -1 });
        const sharedCases = await Case.find({ 'members.user': req.session.userId }).sort({ createdDate: -1 });
        res.json({ owned: myCases, shared: sharedCases });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

// 2. CREATE NEW CASE
router.post('/create', isAuthenticated, async (req, res) => {
    try {
        const { caseID, name, description } = req.body;

        const existing = await Case.findOne({ caseID });
        if (existing) return res.status(400).json({ error: 'Case ID already exists' });

        const newCase = new Case({
            caseID,
            name,
            description,
            owner: req.session.userId
        });
        await newCase.save();

        const userIP = req.ip || req.connection.remoteAddress || 'Unknown';

        // 1. Save to DB
        await CaseLog.create({
            action: 'CASE_CREATED',
            username: req.session.username || 'Unknown',
            ip: userIP,
            caseId: newCase._id,
            details: `Case ID: ${caseID} created`,
            timestamp: new Date()
        });

        // 2. Log to Console
        // Logger.js expects: userId, caseID
        Logger.log('CASE_CREATED', {
            userId: req.session.username,
            caseID: caseID
        });

        res.json({ success: true, case: newCase });
    } catch (err) {
        res.status(500).json({ error: 'Create Failed' });
    }
});

// 3. OPEN CASE
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const kase = await Case.findById(req.params.id);
        if (!kase) return res.status(404).json({ error: 'Case not found' });

        const currentUserId = req.session.userId.toString();
        const isOwner = kase.owner.toString() === currentUserId;
        const member = kase.members.find(m => m.user.toString() === currentUserId);

        if (!isOwner && !member) {
            return res.status(403).json({ error: 'Access Denied' });
        }

        const userIP = req.ip || req.connection.remoteAddress || 'Unknown';

        // 1. Save to DB
        await CaseLog.create({
            action: 'CASE_OPENED',
            username: req.session.username || 'Unknown',
            ip: userIP,
            caseId: kase._id,
            details: 'Case Viewed',
            timestamp: new Date()
        });

        // 2. Log to Console
        // Logger.js expects: User, CaseID (Capitalized for this one specific action)
        Logger.log('CASE_OPENED', {
            User: req.session.username,
            CaseID: kase.caseID
        });

        res.json({
            case: kase,
            role: isOwner ? 'owner' : member.role,
            canUpload: isOwner || ['contributor', 'manager'].includes(member?.role),
            canDelete: isOwner || member?.role === 'manager'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error opening case' });
    }
});

// 4. ADD/UPDATE TEAM MEMBER
router.post('/invite', isAuthenticated, async (req, res) => {
    try {
        const { caseId, username, role } = req.body;
        const kase = await Case.findOne({ _id: caseId, owner: req.session.userId });

        if (!kase) return res.status(403).json({ error: 'Only case owner can invite users' });

        const userToAdd = await User.findOne({ username });
        if (!userToAdd) return res.status(404).json({ error: 'User not found' });

        const existingIndex = kase.members.findIndex(m => m.user.toString() === userToAdd._id.toString());
        let action = 'CASE_MEMBER_ADDED';

        if (existingIndex > -1) {
            kase.members[existingIndex].role = role;
            action = 'CASE_MEMBER_UPDATED';
        } else {
            kase.members.push({ user: userToAdd._id, username: userToAdd.username, role });
        }

        await kase.save();

        const userIP = req.ip || req.connection.remoteAddress || 'Unknown';

        // 1. Save to DB
        await CaseLog.create({
            action: action,
            username: req.session.username || 'Unknown',
            ip: userIP,
            caseId: kase._id,
            details: `User: ${username} | Role: ${role}`,
            timestamp: new Date()
        });

        // 2. Log to Console
        // Logger.js expects: userId, caseID, member, role/newRole
        Logger.log(action, {
            userId: req.session.username,
            caseID: kase.caseID,
            member: username,
            role: role,
            newRole: role // Passed for 'UPDATED' event
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Invite failed' });
    }
});

// 5. REMOVE MEMBER
router.post('/remove-member', isAuthenticated, async (req, res) => {
    try {
        const { caseId, memberId } = req.body;
        const kase = await Case.findOne({ _id: caseId, owner: req.session.userId });

        if (!kase) return res.status(403).json({ error: 'Permission Denied' });

        const memberToRemove = kase.members.find(m => m.user.toString() === memberId);
        const memberName = memberToRemove ? memberToRemove.username : 'Unknown ID';

        kase.members = kase.members.filter(m => m.user.toString() !== memberId);
        await kase.save();

        const userIP = req.ip || req.connection.remoteAddress || 'Unknown';

        // 1. Save to DB
        await CaseLog.create({
            action: 'CASE_MEMBER_REMOVED',
            username: req.session.username || 'Unknown',
            ip: userIP,
            caseId: kase._id,
            details: `Removed User: ${memberName}`,
            timestamp: new Date()
        });

        // 2. Log to Console
        // Logger.js expects: userId, caseID, member
        Logger.log('CASE_MEMBER_REMOVED', {
            userId: req.session.username,
            caseID: kase.caseID,
            member: memberName
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Remove failed' });
    }
});

// 6. DELETE CASE
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const kase = await Case.findOne({ _id: req.params.id, owner: req.session.userId });
        if (!kase) return res.status(404).json({ error: 'Case not found or permission denied' });

        const images = await Image.find({ caseId: kase._id });
        for (const img of images) {
            const filePath = path.join(uploadDir, img.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await CaseLog.deleteMany({ imageId: img._id });
        }

        await Image.deleteMany({ caseId: kase._id });
        await Case.deleteOne({ _id: kase._id });

        const userIP = req.ip || req.connection.remoteAddress || 'Unknown';

        // 1. Save to DB
        await CaseLog.create({
            action: 'CASE_DELETED',
            username: req.session.username || 'Unknown',
            ip: userIP,
            caseId: kase._id,
            details: `Case ID: ${kase.caseID} deleted`,
            timestamp: new Date()
        });

        // 2. Log to Console
        // Logger.js expects: userId, caseID
        Logger.log('CASE_DELETED', {
            userId: req.session.username,
            caseID: kase.caseID
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: 'Failed to delete case' });
    }
});

module.exports = router;