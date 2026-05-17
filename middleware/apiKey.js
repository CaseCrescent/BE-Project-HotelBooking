// X-API-Key gate for the public chatbot API.
// Reads PUBLIC_API_KEY from env; fails closed if not configured.
// Uses a constant-time comparison to avoid timing-based key disclosure.
const crypto = require('crypto');

function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

module.exports = function requireApiKey(req, res, next) {
    const expected = process.env.PUBLIC_API_KEY;
    if (!expected || expected.length < 16) {
        return res.status(503).json({ success: false, message: 'Public API not configured (PUBLIC_API_KEY missing)' });
    }
    const presented = req.header('x-api-key') || req.header('X-API-Key') || '';
    if (!constantTimeEqual(presented, expected)) {
        return res.status(401).json({ success: false, message: 'Invalid or missing X-API-Key' });
    }
    next();
};
