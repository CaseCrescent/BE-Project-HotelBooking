const express = require('express');
const {
    getUsers,
    getUser,
    banUser,
    unbanUser,
    promoteUser,
    demoteUser
} = require('../controllers/users');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// All routes admin-only.
router.use(protect, authorize('admin'));

router.get('/', getUsers);
router.get('/:id', getUser);
router.patch('/:id/ban', banUser);
router.patch('/:id/unban', unbanUser);
router.patch('/:id/promote', promoteUser);
router.patch('/:id/demote', demoteUser);

module.exports = router;
