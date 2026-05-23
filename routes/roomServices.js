const express = require('express');
const {
    getRoomServices,
    getRoomService,
    addRoomService,
    updateRoomService,
    deleteRoomService
} = require('../controllers/roomServices');

const router = express.Router({ mergeParams: true });
const { protect, softAuth, authorize } = require('../middleware/auth');

// softAuth on GETs so admin can read inactive services with ?includeInactive=true
router.route('/')
    .get(softAuth, getRoomServices)
    .post(protect, authorize('admin'), addRoomService);

router.route('/:id')
    .get(softAuth, getRoomService)
    .put(protect, authorize('admin'), updateRoomService)
    .delete(protect, authorize('admin'), deleteRoomService);

module.exports = router;
