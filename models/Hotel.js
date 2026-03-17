const mongoose = require('mongoose');

// เปลี่ยนจาก HospitalSchema เป็น HotelSchema
const HotelSchema = new mongoose.Schema({
    // ตาม Requirement ข้อ 3: hotel name, address, and telephone number
    name: {
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name can not be more than 50 characters']
    },
    address: {
        type: String,
        required: [true, 'Please add an address'],
    },
    tel: {
        type: String,
        required: [true, 'Please add a telephone number']
    }
},{
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

//Reverse populate with virtuals
// เปลี่ยนจาก appointments เป็น bookings
HotelSchema.virtual('bookings', {
    ref: 'Booking', // อ้างอิงไปที่ Model Booking
    localField: '_id',
    foreignField: 'hotel', // อ้างอิงไปที่ฟิลด์ hotel ใน Booking
    justOne: false
});

//**Add**//

// Cascade delete bookings when a hotel is deleted
HotelSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    console.log(`Bookings being removed from hotel ${this._id}`);
    await this.model('Booking').deleteMany({ hotel: this._id });
});

// เปลี่ยน export เป็น Hotel
module.exports = mongoose.model('Hotel', HotelSchema);