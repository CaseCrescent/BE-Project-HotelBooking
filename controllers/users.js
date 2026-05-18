const User = require('../models/User');

// @desc    List all users (admin)
// @route   GET /api/v1/users
// @access  Private (admin)
exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const startIndex = (page - 1) * limit;

        const filter = {};
        if (req.query.role) filter.role = req.query.role;
        if (req.query.banned === 'true') filter.banned = true;
        if (req.query.banned === 'false') filter.banned = { $ne: true };

        const [users, total] = await Promise.all([
            User.find(filter).sort('-createdAt').skip(startIndex).limit(limit),
            User.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            pagination: { page, limit, pages: Math.ceil(total / limit) },
            data: users
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot fetch users' });
    }
};

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private (admin)
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot fetch user' });
    }
};

// Helper: reject self-targeted destructive ops.
function blockSelfTarget(req, res) {
    if (req.params.id === req.user.id) {
        res.status(400).json({ success: false, message: 'You cannot perform this action on your own account' });
        return true;
    }
    return false;
}

// @desc    Ban a user (sets banned=true). protect middleware then rejects their token.
// @route   PATCH /api/v1/users/:id/ban
// @access  Private (admin)
exports.banUser = async (req, res) => {
    if (blockSelfTarget(req, res)) return;
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { banned: true, bannedAt: new Date() },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot ban user' });
    }
};

// @desc    Unban a user
// @route   PATCH /api/v1/users/:id/unban
// @access  Private (admin)
exports.unbanUser = async (req, res) => {
    if (blockSelfTarget(req, res)) return;
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { banned: false, bannedAt: null },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot unban user' });
    }
};

// @desc    Promote user to admin
// @route   PATCH /api/v1/users/:id/promote
// @access  Private (admin)
exports.promoteUser = async (req, res) => {
    if (blockSelfTarget(req, res)) return;
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { role: 'admin' }, { new: true });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot promote user' });
    }
};

// @desc    Demote admin to user
// @route   PATCH /api/v1/users/:id/demote
// @access  Private (admin)
exports.demoteUser = async (req, res) => {
    if (blockSelfTarget(req, res)) return;
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { role: 'user' }, { new: true });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Cannot demote user' });
    }
};
