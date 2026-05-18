const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
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
    score: {
        type: Number,
        required: [true, 'Please provide a score from 1 to 5'],
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        default: '',
        maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    likes: {
        type: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
        default: []
    },
    dislikes: {
        type: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// One review per user per hotel.
ReviewSchema.index({ user: 1, hotel: 1 }, { unique: true });
ReviewSchema.index({ hotel: 1, createdAt: -1 });

// Recompute Hotel.rating as the mean of all review scores for that hotel.
// Wrapped in try/catch so a failed recalc never breaks the underlying review save.
ReviewSchema.statics.calcAverageRating = async function (hotelId) {
    try {
        const result = await this.aggregate([
            { $match: { hotel: new mongoose.Types.ObjectId(hotelId) } },
            { $group: { _id: '$hotel', avg: { $avg: '$score' }, count: { $sum: 1 } } }
        ]);
        const avg = result[0]?.avg;
        await this.model('Hotel').findByIdAndUpdate(hotelId, {
            rating: avg != null ? Math.round(avg * 10) / 10 : null
        });
    } catch (err) {
        console.error('calcAverageRating failed:', err.message);
    }
};

ReviewSchema.post('save', function () {
    this.constructor.calcAverageRating(this.hotel);
});

// `deleteOne` fired on the document (review.deleteOne()) — recalc the hotel mean.
ReviewSchema.post('deleteOne', { document: true, query: false }, function () {
    this.constructor.calcAverageRating(this.hotel);
});

module.exports = mongoose.model('Review', ReviewSchema);
