const mongoose = require('mongoose');

const RoomServiceSchema = new mongoose.Schema({
    hotel: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide a service name'],
        trim: true,
        maxlength: [80, 'Name cannot exceed 80 characters']
    },
    description: {
        type: String,
        default: '',
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    price: {
        type: Number,
        default: 0,
        min: [0, 'Price cannot be negative']
    },
    // null = unlimited capacity per day (e.g. parking, breakfast for paying guests)
    dailyCapacity: {
        type: Number,
        default: null,
        min: [1, 'Capacity must be at least 1 when set']
    },
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

RoomServiceSchema.index({ hotel: 1, active: 1 });

module.exports = mongoose.model('RoomService', RoomServiceSchema);
