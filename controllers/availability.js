const Hotel = require('../models/Hotel');
const { dailyAvailability, hasAvailability, toUtcMidnight, addDays } = require('../utils/availability');

// @desc    Per-day availability for a single hotel
// @route   GET /api/v1/hotels/:hotelId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// @access  Public
exports.getHotelAvailability = async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.hotelId);
        if (!hotel) {
            return res.status(404).json({ success: false, message: 'Hotel not found' });
        }

        const now = toUtcMidnight(new Date());
        const from = req.query.from ? toUtcMidnight(req.query.from) : now;
        const to = req.query.to ? toUtcMidnight(req.query.to) : addDays(from, 14);

        if (to <= from) {
            return res.status(400).json({ success: false, message: '`to` must be after `from`' });
        }

        const days = await dailyAvailability(hotel, from, to);
        res.status(200).json({
            success: true,
            data: {
                hotel: { _id: hotel._id, name: hotel.name, roomCount: hotel.roomCount, pricePerNight: hotel.pricePerNight },
                from: from.toISOString().slice(0, 10),
                to: to.toISOString().slice(0, 10),
                days
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Cannot compute availability' });
    }
};

// @desc    Find earliest available rooms across hotels for a given trip length
// @route   GET /api/v1/availability/find?nights=2&days=7[&hotel=<id>]
// @access  Public
exports.findEarliest = async (req, res) => {
    try {
        const nights = Math.min(3, Math.max(1, parseInt(req.query.nights, 10) || 1));
        const windowDays = Math.min(60, Math.max(1, parseInt(req.query.days, 10) || 7));
        const hotelFilter = req.query.hotel ? { _id: req.query.hotel } : {};

        const hotels = await Hotel.find(hotelFilter).limit(50);
        const today = toUtcMidnight(new Date());
        const horizon = addDays(today, windowDays);

        const results = [];
        for (const hotel of hotels) {
            const days = await dailyAvailability(hotel, today, horizon);
            // walk a sliding window of length `nights`
            for (let i = 0; i + nights <= days.length; i++) {
                const slice = days.slice(i, i + nights);
                if (slice.every((d) => d.available > 0)) {
                    const minAvail = Math.min(...slice.map((d) => d.available));
                    results.push({
                        hotel: {
                            _id: hotel._id,
                            name: hotel.name,
                            address: hotel.address,
                            picture: hotel.picture,
                            pricePerNight: hotel.pricePerNight,
                            rating: hotel.rating
                        },
                        checkIn: slice[0].date,
                        nights,
                        roomsAvailable: minAvail,
                        totalPrice: (hotel.pricePerNight || 0) * nights
                    });
                    break; // earliest window for this hotel
                }
            }
        }

        // Earliest check-in first; then by price.
        results.sort((a, b) => {
            if (a.checkIn !== b.checkIn) return a.checkIn < b.checkIn ? -1 : 1;
            return a.totalPrice - b.totalPrice;
        });

        res.status(200).json({ success: true, count: results.length, data: results.slice(0, 12) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Cannot compute earliest availability' });
    }
};

// @desc    Quick availability check
// @route   GET /api/v1/hotels/:hotelId/availability/check?date=YYYY-MM-DD&nights=N
// @access  Public
exports.checkAvailability = async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.hotelId);
        if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
        const date = req.query.date;
        const nights = parseInt(req.query.nights, 10) || 1;
        if (!date) return res.status(400).json({ success: false, message: '`date` is required (YYYY-MM-DD)' });
        const ok = await hasAvailability(hotel, date, nights);
        res.status(200).json({ success: true, data: { available: ok, hotel: hotel._id, date, nights } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Cannot check availability' });
    }
};
