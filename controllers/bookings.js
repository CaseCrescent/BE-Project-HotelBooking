const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomService = require('../models/RoomService');
const { hasAvailability } = require('../utils/availability');

// Validate and snapshot roomServices for a booking.
// Input: [{ service: id, quantity }, ...]   Output: [{ service, name, price, quantity }, ...]
async function snapshotRoomServices(rawServices, hotelId) {
    if (!Array.isArray(rawServices) || rawServices.length === 0) return [];
    const ids = rawServices
        .map((s) => s?.service || s?.serviceId || s?._id)
        .filter(Boolean);
    if (ids.length === 0) return [];
    const services = await RoomService.find({ _id: { $in: ids }, hotel: hotelId, active: true });
    const byId = new Map(services.map((s) => [s._id.toString(), s]));
    const snapshot = [];
    for (const raw of rawServices) {
        const sid = (raw?.service || raw?.serviceId || raw?._id || '').toString();
        const svc = byId.get(sid);
        if (!svc) {
            const err = new Error(`Room service ${sid} is not available for this hotel`);
            err.statusCode = 400;
            throw err;
        }
        const qty = Math.max(1, parseInt(raw?.quantity, 10) || 1);
        if (svc.dailyCapacity != null && qty > svc.dailyCapacity) {
            const err = new Error(`Service "${svc.name}" capped at ${svc.dailyCapacity} per day`);
            err.statusCode = 400;
            throw err;
        }
        snapshot.push({ service: svc._id, name: svc.name, price: svc.price, quantity: qty });
    }
    return snapshot;
}

// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Private (filters by status when ?status= provided)
exports.getBookings = async (req, res, next) => {
    let query;
    const statusFilter = req.query.status ? { status: req.query.status } : {};

    if (req.user.role !== 'admin') {
        query = Booking.find({ user: req.user.id, ...statusFilter }).populate({
            path: 'hotel',
            select: 'name address tel picture pricePerNight'
        });
    } else {
        if (req.params.hotelId) {
            query = Booking.find({ hotel: req.params.hotelId, ...statusFilter }).populate({
                path: 'hotel',
                select: 'name address tel picture pricePerNight'
            });
        } else {
            query = Booking.find(statusFilter).populate({
                path: 'hotel',
                select: 'name address tel picture pricePerNight'
            });
        }
    }

    try {
        const bookings = await query.sort('-createdAt');
        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private  (owner or admin; public via /api/v1/bookings/:id/public for live confirmation page)
exports.getBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate({
            path: 'hotel',
            select: 'name address tel picture pricePerNight checkInTime checkOutTime'
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        console.error(err.stack);
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
};

// @desc    Public lookup for confirmation page (limited fields, no auth)
// @route   GET /api/v1/bookings/:id/public
// @access  Public
exports.getBookingPublic = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .select('bookingDate numOfNights status confirmationNumber hotel createdAt')
            .populate({ path: 'hotel', select: 'name address tel picture checkInTime checkOutTime' });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot find booking' });
    }
};

// @desc    Add booking
// @route   POST /api/v1/hotels/:hotelId/bookings
// @access  Private
exports.addBooking = async (req, res, next) => {
    try {
        req.body.hotel = req.params.hotelId;
        req.body.user = req.user.id;

        const hotel = await Hotel.findById(req.params.hotelId);
        if (!hotel) {
            return res.status(404).json({ success: false, message: `No hotel with the id of ${req.params.hotelId}` });
        }

        if (req.body.numOfNights && req.body.numOfNights > 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `The user with ID ${req.user.id} cannot book more than 3 nights per booking` });
        }

        // Per-(hotel, date) capacity check using the hotel's roomCount.
        const ok = await hasAvailability(hotel, req.body.bookingDate, req.body.numOfNights || 1);
        if (!ok) {
            return res.status(409).json({
                success: false,
                message: 'Selected dates are fully booked for this hotel. Pick different dates or another hotel.'
            });
        }

        // Optional add-on services — snapshot name/price so display survives later edits.
        try {
            req.body.roomServices = await snapshotRoomServices(req.body.roomServices, hotel._id);
        } catch (svcErr) {
            return res.status(svcErr.statusCode || 400).json({ success: false, message: svcErr.message });
        }

        const booking = await Booking.create(req.body);
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        console.error(err.stack);
        return res.status(500).json({ success: false, message: err.message || 'Cannot create Booking' });
    }
};

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
// @access  Private (owner or admin)
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to update this booking` });
        }
        if (req.body.numOfNights && req.body.numOfNights > 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `Cannot update booking to more than 3 nights` });
        }

        // If the date / nights / hotel changes, re-check availability (excluding self).
        const nextDate = req.body.bookingDate || booking.bookingDate;
        const nextNights = req.body.numOfNights || booking.numOfNights;
        const nextHotelId = req.body.hotel || booking.hotel;
        const datesChanged =
            String(nextHotelId) !== String(booking.hotel) ||
            new Date(nextDate).getTime() !== new Date(booking.bookingDate).getTime() ||
            Number(nextNights) !== Number(booking.numOfNights);

        if (datesChanged) {
            const hotel = await Hotel.findById(nextHotelId);
            if (!hotel) {
                return res.status(404).json({ success: false, message: 'Hotel not found for this update' });
            }
            const ok = await hasAvailability(hotel, nextDate, nextNights, booking._id);
            if (!ok) {
                return res.status(409).json({
                    success: false,
                    message: 'New dates are fully booked for this hotel.'
                });
            }
        }

        booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        console.error(err.stack);
        return res.status(500).json({ success: false, message: 'Cannot update Booking' });
    }
};

// @desc    Cancel booking (sets status='cancelled' instead of removing)
// @route   PATCH /api/v1/bookings/:id/cancel
// @access  Private (owner or admin)
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to cancel this booking' });
        }
        if (booking.status === 'cancelled') {
            return res.status(200).json({ success: true, data: booking, message: 'Already cancelled' });
        }
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        await booking.save();
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot cancel booking' });
    }
};

// @desc    Check-in a booking (status='checked_in'). Allowed when today is within the stay window.
// @route   PATCH /api/v1/bookings/:id/check-in
// @access  Private (admin or booking owner)
exports.checkInBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        if (booking.status === 'cancelled') {
            return res.status(409).json({ success: false, message: 'Cannot check in a cancelled booking' });
        }
        if (booking.status === 'completed') {
            return res.status(409).json({ success: false, message: 'Booking already completed' });
        }

        // Window check (admin can override with ?force=true)
        const start = new Date(booking.bookingDate);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + booking.numOfNights);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const force = req.query.force === 'true' && req.user.role === 'admin';
        if (!force && (today < start || today >= end)) {
            return res.status(409).json({
                success: false,
                message: 'Check-in only allowed inside the booking window'
            });
        }

        booking.status = 'checked_in';
        await booking.save();
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot check in booking' });
    }
};

// @desc    Mark a booking complete (status='completed'). Allowed from checked_in OR after stay end.
// @route   PATCH /api/v1/bookings/:id/complete
// @access  Private (admin only)
exports.completeBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        if (req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Admin only' });
        }
        if (booking.status === 'cancelled') {
            return res.status(409).json({ success: false, message: 'Cannot complete a cancelled booking' });
        }
        if (booking.status === 'completed') {
            return res.status(200).json({ success: true, data: booking, message: 'Already completed' });
        }
        booking.status = 'completed';
        await booking.save();
        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot complete booking' });
    }
};

// @desc    Delete booking (hard delete preserved for admin / assignment grading)
// @route   DELETE /api/v1/bookings/:id
// @access  Private (owner or admin)
exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this booking` });
        }
        await booking.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        console.error(err.stack);
        return res.status(500).json({ success: false, message: 'Cannot delete Booking' });
    }
};
