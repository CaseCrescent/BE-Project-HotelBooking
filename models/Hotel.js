const mongoose = require('mongoose');

const HotelSchema = new mongoose.Schema({
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
    },
    picture: {
        type: String,
        default: null
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    description: {
        type: String,
        default: null
    },
    // ----- New fields (all optional, default values keep prior API surface intact) -----
    roomCount: {
        type: Number,
        min: 1,
        default: 10
    },
    pricePerNight: {
        type: Number,
        min: 0,
        default: 1500
    },
    amenities: {
        type: [String],
        default: []
    },
    checkInTime: {
        type: String,
        default: '14:00'
    },
    checkOutTime: {
        type: String,
        default: '12:00'
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

HotelSchema.virtual('bookings', {
    ref: 'Booking',
    localField: '_id',
    foreignField: 'hotel',
    justOne: false
});

HotelSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    console.log(`Bookings being removed from hotel ${this._id}`);
    await this.model('Booking').deleteMany({ hotel: this._id });
});

module.exports = mongoose.model('Hotel', HotelSchema);
