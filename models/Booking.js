const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    bookingDate: {
        type: Date,
        required: true
    },
    numOfNights: {
        type: Number,
        required: [true, 'Please specify the number of nights'],
        min: [1, 'Must book at least 1 night'],
        max: [3, 'Can book up to 3 nights only']
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    hotel: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel',
        required: true
    },
    // ----- New fields (all optional, prior API still works) -----
    status: {
        type: String,
        enum: ['confirmed', 'cancelled', 'completed', 'checked_in'],
        default: 'confirmed',
        index: true
    },
    confirmationNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    guestCount: {
        type: Number,
        min: 1,
        default: 1
    },
    specialRequests: {
        type: String,
        default: ''
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Cheap, human-readable confirmation number: HB-<yyMMdd>-<random6>
// Generated only on first save when missing.
BookingSchema.pre('save', async function (next) {
    if (this.isNew && !this.confirmationNumber) {
        const d = new Date(this.bookingDate || Date.now());
        const yy = String(d.getUTCFullYear()).slice(-2);
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
        this.confirmationNumber = `HB-${yy}${mm}${dd}-${rand}`;
    }
    next();
});

// Lookup helpers
BookingSchema.index({ hotel: 1, bookingDate: 1, status: 1 });
BookingSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', BookingSchema);
