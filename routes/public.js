const express = require('express');
const requireApiKey = require('../middleware/apiKey');
const { health, listHotels, availability, createBooking, getBooking } = require('../controllers/public');

const router = express.Router();

// Open
router.get('/health', health);

// Gated by X-API-Key
router.get('/hotels', requireApiKey, listHotels);
router.get('/availability', requireApiKey, availability);
router.post('/bookings', requireApiKey, createBooking);
router.get('/bookings/:id', requireApiKey, getBooking);

module.exports = router;
