const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { hasAvailability, dailyAvailability, toUtcMidnight, addDays } = require('../utils/availability');

// Health check (open).
exports.health = async (req, res) => {
    try {
        const n = await Hotel.estimatedDocumentCount();
        res.status(200).json({ success: true, status: 'ok', hotels: n });
    } catch (err) {
        res.status(500).json({ success: false, status: 'down' });
    }
};

// GET /api/public/hotels?q=&limit=
exports.listHotels = async (req, res) => {
    try {
        const limit = Math.min(50, parseInt(req.query.limit, 10) || 25);
        const q = (req.query.q || '').trim();
        const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
        const hotels = await Hotel.find(filter)
            .select('name address tel picture rating description pricePerNight roomCount checkInTime checkOutTime')
            .limit(limit);
        res.status(200).json({ success: true, count: hotels.length, data: hotels });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot list hotels' });
    }
};

// GET /api/public/availability?hotel=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
exports.availability = async (req, res) => {
    try {
        if (!req.query.hotel) {
            return res.status(400).json({ success: false, message: '`hotel` (id) is required' });
        }
        const hotel = await Hotel.findById(req.query.hotel);
        if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

        const today = toUtcMidnight(new Date());
        const from = req.query.from ? toUtcMidnight(req.query.from) : today;
        const to = req.query.to ? toUtcMidnight(req.query.to) : addDays(from, 7);

        const days = await dailyAvailability(hotel, from, to);
        res.status(200).json({
            success: true,
            data: {
                hotel: { _id: hotel._id, name: hotel.name, pricePerNight: hotel.pricePerNight, roomCount: hotel.roomCount },
                from: from.toISOString().slice(0, 10),
                to: to.toISOString().slice(0, 10),
                days
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot compute availability' });
    }
};

// POST /api/public/bookings
// Body: { hotelId, name, tel, email?, bookingDate, numOfNights }
// Find-or-create user by tel (deterministic email if not provided).
exports.createBooking = async (req, res) => {
    try {
        const { hotelId, name, tel, email, bookingDate, numOfNights } = req.body || {};
        if (!hotelId || !name || !tel || !bookingDate) {
            return res.status(400).json({ success: false, message: 'hotelId, name, tel, bookingDate are required' });
        }
        const nights = Math.min(3, Math.max(1, parseInt(numOfNights, 10) || 1));
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

        const ok = await hasAvailability(hotel, bookingDate, nights);
        if (!ok) {
            return res.status(409).json({ success: false, message: 'Selected dates are fully booked' });
        }

        // Find-or-create user — chatbot guests get a deterministic placeholder email.
        const userEmail = (email && /\S+@\S+\.\S+/.test(email))
            ? email
            : `chatbot+${String(tel).replace(/\D/g, '')}@hotelbooking.local`;
        let user = await User.findOne({ email: userEmail });
        if (!user) {
            const tempPassword = await bcrypt.genSalt(10).then((s) => bcrypt.hash(`chatbot:${Date.now()}:${userEmail}`, s));
            user = await User.create({
                name,
                tel: String(tel),
                email: userEmail,
                password: tempPassword,
                role: 'user'
            });
        }

        // Cap chatbot abuse: max 3 active bookings per phone per 24h.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeRecent = await Booking.countDocuments({
            user: user._id,
            status: { $in: ['confirmed', 'checked_in'] },
            createdAt: { $gte: since }
        });
        if (activeRecent >= 3) {
            return res.status(429).json({ success: false, message: 'Too many recent bookings for this phone number' });
        }

        const booking = await Booking.create({
            hotel: hotel._id,
            user: user._id,
            bookingDate,
            numOfNights: nights,
            specialRequests: (req.body.specialRequests || '').slice(0, 500)
        });

        res.status(201).json({
            success: true,
            data: {
                _id: booking._id,
                confirmationNumber: booking.confirmationNumber,
                bookingDate: booking.bookingDate,
                numOfNights: booking.numOfNights,
                hotel: { _id: hotel._id, name: hotel.name, address: hotel.address, tel: hotel.tel },
                ticket_url: `${req.protocol}://${req.get('host')}/booking/${booking._id}`
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message || 'Cannot create booking' });
    }
};

// GET /api/public/bookings/:id
exports.getBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .select('bookingDate numOfNights status confirmationNumber hotel createdAt')
            .populate({ path: 'hotel', select: 'name address tel checkInTime checkOutTime' });
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot fetch booking' });
    }
};
