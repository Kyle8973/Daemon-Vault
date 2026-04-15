// db.js - MongoDB connection setup Using Mongoose

const mongoose = require('mongoose');
const chalk = require('chalk');
const time = new Date().toLocaleTimeString('en-GB'); // "13:25:12" (24h format)
let output = `[${chalk.gray(time)}] `;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/daemon_vault');
        console.log(output += `${chalk.green.bold('[MongoDB Connected]')}`);
    } catch (err) {
        console.log(output += `${chalk.red.bold('[MongoDB Connection Error]')}`);
        process.exit(1);
    }
};

module.exports = connectDB;