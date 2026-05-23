const jwt = require('jsonwebtoken');
const User = require('../models/User');

//Protect routes — reports the actual JWT failure mode so the client can prompt re-login.
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({
            success: false,
            code: 'NO_TOKEN',
            message: 'Sign in to access this route'
        });
    }

    if (!process.env.JWT_SECRET) {
        // Misconfigured server — make this loud so it can be fixed.
        console.error('[auth] JWT_SECRET is not set in config/config.env');
        return res.status(500).json({
            success: false,
            code: 'JWT_SECRET_MISSING',
            message: 'Server auth misconfigured (JWT_SECRET not set)'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);

        if (!req.user) {
            return res.status(401).json({
                success: false,
                code: 'USER_GONE',
                message: 'Your account no longer exists — please register again'
            });
        }
        if (req.user.banned) {
            return res.status(403).json({
                success: false,
                code: 'BANNED',
                message: 'Account suspended. Contact an administrator.'
            });
        }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired — please sign in again'
            });
        }
        if (err.name === 'JsonWebTokenError') {
            // Bad signature → JWT_SECRET likely changed since the token was issued.
            return res.status(401).json({
                success: false,
                code: 'TOKEN_INVALID',
                message: 'Session is no longer valid — please sign in again'
            });
        }
        console.error('[auth] unexpected protect error:', err);
        return res.status(401).json({
            success: false,
            code: 'AUTH_ERROR',
            message: 'Could not verify your session — please sign in again'
        });
    }
}

// Soft-auth: populates req.user if a valid Bearer token is present, but does NOT reject
// missing/invalid tokens. Use on routes that are public-readable but unlock extra fields
// or behaviors for authenticated callers (e.g. admins seeing inactive resources).
exports.softAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token || token === 'null') return next();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user && !user.banned) req.user = user;
    } catch {
        // Bad token — fall through as anonymous.
    }
    next();
};

//Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: `User role ${req.user.role} is not authorized to access this route` });
        }
        next();
    }
};