const express = require('express');
const { getHotels, getHotel, createHotel, updateHotel, deleteHotel } = require('../controllers/hotels');
const { getHotelAvailability, checkAvailability } = require('../controllers/availability');

const bookingRouter = require('./bookings');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// Nested routers
router.use('/:hotelId/bookings', bookingRouter);

// Per-hotel availability (public)
router.get('/:hotelId/availability', getHotelAvailability);
router.get('/:hotelId/availability/check', checkAvailability);

router.route('/')
    .get(getHotels)
    .post(protect, authorize('admin'), createHotel);

router.route('/:id')
    .get(getHotel)
    .put(protect, authorize('admin'), updateHotel)
    .delete(protect, authorize('admin'), deleteHotel);

module.exports = router;
