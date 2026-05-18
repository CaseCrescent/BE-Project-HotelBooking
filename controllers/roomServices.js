const RoomService = require('../models/RoomService');
const Hotel = require('../models/Hotel');

// @desc    List room services (optionally filtered by hotel)
// @route   GET /api/v1/roomservices
// @route   GET /api/v1/hotels/:hotelId/roomservices
// @access  Public
exports.getRoomServices = async (req, res) => {
    try {
        const filter = {};
        const hotelId = req.params.hotelId || req.query.hotel;
        if (hotelId) filter.hotel = hotelId;
        // Public callers see only active services; admin can pass ?includeInactive=true
        const includeInactive = req.query.includeInactive === 'true' && req.user?.role === 'admin';
        if (!includeInactive) filter.active = true;

        const services = await RoomService.find(filter)
            .populate({ path: 'hotel', select: 'name' })
            .sort('name');
        res.status(200).json({ success: true, count: services.length, data: services });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot fetch room services' });
    }
};

// @desc    Get single room service
// @route   GET /api/v1/roomservices/:id
// @access  Public
exports.getRoomService = async (req, res) => {
    try {
        const service = await RoomService.findById(req.params.id).populate({ path: 'hotel', select: 'name' });
        if (!service) {
            return res.status(404).json({ success: false, message: 'Room service not found' });
        }
        res.status(200).json({ success: true, data: service });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot fetch room service' });
    }
};

// @desc    Create room service for a hotel
// @route   POST /api/v1/hotels/:hotelId/roomservices
// @access  Private (admin)
exports.addRoomService = async (req, res) => {
    try {
        const hotelId = req.params.hotelId || req.body.hotel;
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({ success: false, message: 'Hotel not found' });
        }
        const service = await RoomService.create({
            hotel: hotelId,
            name: req.body.name,
            description: req.body.description || '',
            price: req.body.price || 0,
            dailyCapacity: req.body.dailyCapacity ?? null,
            active: req.body.active !== false
        });
        res.status(201).json({ success: true, data: service });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update room service
// @route   PUT /api/v1/roomservices/:id
// @access  Private (admin)
exports.updateRoomService = async (req, res) => {
    try {
        const updates = {};
        ['name', 'description', 'price', 'dailyCapacity', 'active'].forEach((k) => {
            if (req.body[k] !== undefined) updates[k] = req.body[k];
        });
        const service = await RoomService.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        });
        if (!service) {
            return res.status(404).json({ success: false, message: 'Room service not found' });
        }
        res.status(200).json({ success: true, data: service });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete room service (soft — flips active=false)
// @route   DELETE /api/v1/roomservices/:id
// @access  Private (admin)
exports.deleteRoomService = async (req, res) => {
    try {
        // Hard delete when ?hard=true (admin destructive). Otherwise soft-delete.
        if (req.query.hard === 'true') {
            const service = await RoomService.findByIdAndDelete(req.params.id);
            if (!service) {
                return res.status(404).json({ success: false, message: 'Room service not found' });
            }
            return res.status(200).json({ success: true, data: {} });
        }
        const service = await RoomService.findByIdAndUpdate(
            req.params.id,
            { active: false },
            { new: true }
        );
        if (!service) {
            return res.status(404).json({ success: false, message: 'Room service not found' });
        }
        res.status(200).json({ success: true, data: service });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot delete room service' });
    }
};
