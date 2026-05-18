const Review = require('../models/Review');
const Hotel = require('../models/Hotel');

// @desc    Get reviews (optionally filtered by hotel via :hotelId param or ?hotel=)
// @route   GET /api/v1/reviews
// @route   GET /api/v1/hotels/:hotelId/reviews
// @access  Public
exports.getReviews = async (req, res) => {
    try {
        const filter = {};
        const hotelId = req.params.hotelId || req.query.hotel;
        if (hotelId) filter.hotel = hotelId;

        const reviews = await Review.find(filter)
            .populate({ path: 'user', select: 'name' })
            .populate({ path: 'hotel', select: 'name' })
            .sort('-createdAt');

        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot fetch reviews' });
    }
};

// @desc    Get single review
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate({ path: 'user', select: 'name' })
            .populate({ path: 'hotel', select: 'name' });
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        res.status(200).json({ success: true, data: review });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot fetch review' });
    }
};

// @desc    Add review for a hotel
// @route   POST /api/v1/hotels/:hotelId/reviews
// @access  Private (any logged-in user)
exports.addReview = async (req, res) => {
    try {
        const hotelId = req.params.hotelId || req.body.hotel;
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({ success: false, message: 'Hotel not found' });
        }

        const existing = await Review.findOne({ user: req.user.id, hotel: hotelId });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'You have already reviewed this hotel. Edit your existing review instead.'
            });
        }

        const review = await Review.create({
            user: req.user.id,
            hotel: hotelId,
            score: req.body.score,
            comment: req.body.comment || ''
        });

        const populated = await Review.findById(review._id).populate({ path: 'user', select: 'name' });
        res.status(201).json({ success: true, data: populated });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update own review (score / comment)
// @route   PUT /api/v1/reviews/:id
// @access  Private (owner only)
exports.updateReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        if (review.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to edit this review' });
        }

        if (req.body.score !== undefined) review.score = req.body.score;
        if (req.body.comment !== undefined) review.comment = req.body.comment;
        await review.save();

        const populated = await Review.findById(review._id).populate({ path: 'user', select: 'name' });
        res.status(200).json({ success: true, data: populated });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete review (owner OR admin moderation)
// @route   DELETE /api/v1/reviews/:id
// @access  Private (owner or admin)
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to delete this review' });
        }
        await review.deleteOne(); // triggers calcAverageRating
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot delete review' });
    }
};

// @desc    Vote on a review (toggle like / dislike / clear)
// @route   PATCH /api/v1/reviews/:id/vote
// @access  Private (any logged-in user)
// body: { value: 'like' | 'dislike' | null }
exports.voteReview = async (req, res) => {
    try {
        const { value } = req.body;
        if (value !== 'like' && value !== 'dislike' && value !== null) {
            return res.status(400).json({ success: false, message: 'value must be "like", "dislike", or null' });
        }
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        const uid = req.user.id;
        // Remove from both arrays so toggles are atomic.
        review.likes = review.likes.filter((id) => id.toString() !== uid);
        review.dislikes = review.dislikes.filter((id) => id.toString() !== uid);
        if (value === 'like') review.likes.push(uid);
        if (value === 'dislike') review.dislikes.push(uid);
        await review.save();

        res.status(200).json({
            success: true,
            data: {
                _id: review._id,
                likes: review.likes,
                dislikes: review.dislikes,
                likeCount: review.likes.length,
                dislikeCount: review.dislikes.length
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot vote on review' });
    }
};
