const express = require('express');
const {
    getBookings,
    getBooking,
    addBooking,
    updateBooking,
    deleteBooking,
    cancelBooking,
    getBookingPublic
} = require('../controllers/bookings');

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(protect, getBookings)
    .post(protect, authorize('admin', 'user'), addBooking);

// Public, read-only confirmation lookup (no auth) — shareable URL
router.get('/:id/public', getBookingPublic);

router.route('/:id')
    .get(protect, getBooking)
    .put(protect, authorize('admin', 'user'), updateBooking)
    .delete(protect, authorize('admin', 'user'), deleteBooking);

// Soft cancel (preserves the row, flips status to 'cancelled')
router.patch('/:id/cancel', protect, authorize('admin', 'user'), cancelBooking);

module.exports = router;
