const mongoose = require('mongoose');

// เปลี่ยนจาก AppointmentSchema เป็น BookingSchema
const BookingSchema = new mongoose.Schema({
    bookingDate: {
        type: Date,
        required: true
    },
    // Requirement ข้อ 3: book up to 3 nights. เพิ่มฟิลด์สำหรับเก็บจำนวนคืน
    numOfNights: {
        type: Number,
        required: [true, 'Please specify the number of nights'],
        min: [1, 'Must book at least 1 night'],
        max: [3, 'Can book up to 3 nights only'] // จำกัดไว้ที่ 3 คืน
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    // เปลี่ยนจาก hospital เป็น hotel
    hotel: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel', // อ้างอิงไปที่ Model Hotel
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// เปลี่ยน export เป็น Booking
module.exports = mongoose.model('Booking', BookingSchema);