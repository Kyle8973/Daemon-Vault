// utils/Logger.js
// Centralised Logger For Console Output And Optional Database Audit Logs

const SystemLog = require('../models/SystemLog');
const chalk = require('chalk');

// Check Configuration
const ENABLE_DB_LOGS = process.env.ENABLE_DB_LOGS === 'true';

// Logger Object With Log Method For Consistent Logging Throughout The Application
const Logger = {
    log: async (action, details = {}) => {
        if (true) {
            const time = new Date().toLocaleTimeString('en-GB'); 
            let output = `[${chalk.gray(time)}] `;

            switch (action) {
                // --- STARTUP ACTIONS ---
                case 'SYSTEM_LOCKED':
                    output += `${chalk.red.bold('[SYSTEM LOCKED]')}`;
                    break;
                    
                case 'SYSTEM_UNLOCK_SUCCESS':
                    output += `${chalk.green.bold('[SYSTEM UNLOCKED]')} Correct Master Unlock Key Provided`;
                    break;

                case 'SYSTEM_UNLOCK_FAIL':
                    output += `${chalk.red.bold('[UNLOCK FAILED]')} Incorrect Master Unlock Key Provided`;
                    break;
                
                // --- LOGIN ACTIONS ---
                case 'LOGIN_SUCCESS':
                    output += `${chalk.green.bold('[LOGIN SUCCESS]')} [User: ${details.username}] [IP: ${details.ip}]`;
                    break;
                
                case 'LOGIN_FAIL':
                    output += `${chalk.red.bold('[LOGIN FAILED]')} [User: ${details.username || 'Unknown'}] [Reason: ${details.reason || 'N/A'}]`;
                    break;

                case 'LOGIN_BLOCKED':
                    output += `${chalk.red.bold('[LOGIN BLOCKED]')} [User: ${details.username || 'Unknown'}] [Reason: Rate Limits]`;
                    break;

                case 'LOGOUT':
                    output += `${chalk.yellow.bold('[LOGOUT]')} [User: ${details.username || 'Unknown'}] [IP: ${details.ip}]`;
                    break;

                // --- FILE ACTIONS ---
                case 'FILE_UPLOAD':
                    output += `${chalk.green.bold('[FILE UPLOAD]')} [User: ${details.username || 'Unknown'}] [IP: ${details.ip || 'Unknown'}] [File: ${details.fileName}] [Size: ${(details.size / 1024).toFixed(1)}KB]`;
                    break;

                case 'FILE_DELETED':
                    output += `${chalk.red.bold('[FILE DELETED]')} [User: ${details.username || 'Unknown'}] [IP: ${details.ip || 'Unknown'}] [File: ${details.fileName}]`;
                    break;

                case 'UPLOAD_FAIL':
                    output += `${chalk.red.bold('[UPLOAD FAIL]')} [Error: ${details.error}]`;
                    break;

                // --- SYSTEM / DEFAULT ---
                case 'SERVER_START':
                    output += `${chalk.blue.bold('[SYSTEM]')} Server Active On Port ${details.port}`;
                    break;

                default:
                    const detailString = Object.entries(details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ');
                    
                    const badge = action.includes('FAIL') || action.includes('ERROR') 
                        ? chalk.red.bold(`[${action}]`) 
                        : chalk.blue.bold(`[${action}]`);

                    output += `${badge} ${detailString}`;
                    break;

                    // --- CASE LOGS ---
                case 'CASE_CREATED':
                    output += `${chalk.green.bold('[CASE CREATED]')} [User ID: ${details.userId || 'Unknown'}] [Case ID: ${details.caseID || 'Unknown'}]`;
                    break;

                case 'CASE_OPENED':
                    output += `${chalk.green.bold('[CASE OPENED]')} [User: ${details.User || 'Unknown'}] [Case ID: ${details.CaseID || 'Unknown'}]`;
                    break;

                case 'CASE_MEMBER_UPDATED':
                    output += `${chalk.yellow.bold('[CASE MEMBER UPDATED]')} [Case ID: ${details.caseID || 'Unknown'}] [Updated User: ${details.member || 'Unknown'}] [New Role: ${details.newRole || 'Unknown'}] [Updated By: ${details.userId || 'Unknown'}]`;
                    break;

                case 'CASE_MEMBER_ADDED':
                    output += `${chalk.green.bold('[CASE MEMBER ADDED]')} [Case ID: ${details.caseID || 'Unknown'}] [Added User: ${details.member || 'Unknown'}] [Role: ${details.role || 'Unknown'}] [Added By: ${details.userId || 'Unknown'}]`;
                    break;

                case 'CASE_MEMBER_REMOVED':
                    output += `${chalk.red.bold('[CASE MEMBER REMOVED]')} [Case ID: ${details.caseID || 'Unknown'}] [Removed User: ${details.member || 'Unknown'}] [Removed By: ${details.userId || 'Unknown'}]`;
                    break;

                case 'CASE_DELETED':
                    output += `${chalk.red.bold('[CASE DELETED]')} [User ID: ${details.userId || 'Unknown'}] [Case ID: ${details.caseID || 'Unknown'}]`;
                    break;


            }

            console.log(output);
        }

        // --- DATABASE AUDIT LOGGING ---
        if (ENABLE_DB_LOGS) {
            try {
                await SystemLog.create({
                    action: action,
                    details: details
                });
            } catch (err) {
                console.error(chalk.bgRed.white(' DATABASE SYSTEM LOGGING FAILED '), err.message);
            }
        }
    }
};

module.exports = Logger;