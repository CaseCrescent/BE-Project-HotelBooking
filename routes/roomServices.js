const express = require('express');
const {
    getRoomServices,
    getRoomService,
    addRoomService,
    updateRoomService,
    deleteRoomService
} = require('../controllers/roomServices');

const router = express.Router({ mergeParams: true });
const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(getRoomServices)
    .post(protect, authorize('admin'), addRoomService);

router.route('/:id')
    .get(getRoomService)
    .put(protect, authorize('admin'), updateRoomService)
    .delete(protect, authorize('admin'), deleteRoomService);

module.exports = router;
