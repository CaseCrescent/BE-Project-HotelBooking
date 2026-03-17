const mongoose = require('mongoose');
const dns = require('dns'); // 1. อิมพอร์ตโมดูล dns ของ Node.js

// 2. สั่งบังคับให้ Node.js แปลงค่า srv ผ่าน Google DNS (8.8.8.8) โดยตรง ข้าม Windows ไปเลย
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
}

module.exports = connectDB;