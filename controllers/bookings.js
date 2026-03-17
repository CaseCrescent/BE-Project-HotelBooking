const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');

// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Public
exports.getBookings = async (req, res, next) => {
    let query;
    // General users can only see their bookings. Admin can see all bookings
    // Requirement 4 & 7 (View bookings)
    if(req.user.role !== 'admin') {
        query = Booking.find({ user: req.user.id }).populate({
            path: 'hotel',
            select: 'name address tel' // Requirement 3: hotel name, address, and telephone number
        });
    } else {
        if (req.params.hotelId) {
            query = Booking.find({ hotel: req.params.hotelId }).populate({
                path: "hotel",
                select: "name address tel"
            });
        } else {
            query = Booking.find().populate({
                path: 'hotel',
                select: 'name address tel'
            });
        }
    }
    try {
        const bookings = await query;
        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
}

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Public
exports.getBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate({
            path: 'hotel',
            select: 'name address tel'
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }

        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: 'Cannot find Booking' });
    }
}

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

        // Requirement 3: book up to 3 nights
        // ตรวจสอบว่าผู้ใช้จองจำนวนคืนเกิน 3 คืนหรือไม่ (แอดมินสามารถข้ามกฎนี้ได้ถ้าต้องการ แต่ส่วนใหญ่ก็ควรล็อคไว้)
        if(req.body.numOfNights && req.body.numOfNights > 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `The user with ID ${req.user.id} cannot book more than 3 nights per booking` });
        }

        const booking = await Booking.create(req.body);

        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: err.message || 'Cannot create Booking' });
    }
}

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
// @access  Private
exports.updateBooking = async (req, res, next) => {
    try {
        let booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }

        // Requirement 5 & 8: user to edit his bookings / admin to edit any bookings
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to update this booking` });
        }

        // Requirement 3: Prevent updating to more than 3 nights
        if(req.body.numOfNights && req.body.numOfNights > 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `Cannot update booking to more than 3 nights` });
        }

        booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: booking });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: 'Cannot update Booking' });
    }
}

// @desc    Delete booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private
exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: `No booking with the id of ${req.params.id}` });
        }

        // Requirement 6 & 9: user to delete his bookings / admin to delete any bookings
        if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this booking` });
        }

        await booking.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: 'Cannot delete Booking' });
    }
}