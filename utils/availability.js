// Per-(hotel, date) availability helper.
// Returns the number of rooms taken on each calendar day in a [from, to) UTC range,
// based on the hotel's existing bookings (status confirmed/checked_in count, cancelled/completed do not).

const Booking = require('../models/Booking');

const ACTIVE_STATUSES = ['confirmed', 'checked_in'];

function toUtcMidnight(d) {
    const date = d instanceof Date ? d : new Date(d);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(d, n) {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + n);
    return next;
}

function dateKey(d) {
    const u = toUtcMidnight(d);
    return u.toISOString().slice(0, 10);
}

/**
 * Compute booked-room count per day for a hotel across a date range.
 * Counts a booking's check-in date and each subsequent night up to numOfNights - 1.
 *
 * @param {string} hotelId
 * @param {Date|string} from inclusive (UTC midnight)
 * @param {Date|string} to   exclusive (UTC midnight)
 * @param {string|null} excludeBookingId  ignore this booking when counting (used for reschedule self-check)
 * @returns {Promise<Record<string, number>>}  { 'YYYY-MM-DD': bookedCount }
 */
async function bookedCountByDay(hotelId, from, to, excludeBookingId = null) {
    const fromUtc = toUtcMidnight(from);
    const toUtc = toUtcMidnight(to);

    const bookings = await Booking.find({
        hotel: hotelId,
        status: { $in: ACTIVE_STATUSES },
        // Booking overlap: bookingDate + numOfNights > fromUtc AND bookingDate < toUtc.
        // Pulling generously and filtering in JS keeps the index simple.
        bookingDate: { $lt: toUtc }
    }).select('_id bookingDate numOfNights');

    const counts = {};
    for (const b of bookings) {
        if (excludeBookingId && String(b._id) === String(excludeBookingId)) continue;
        const start = toUtcMidnight(b.bookingDate);
        const nights = Math.max(1, b.numOfNights || 1);
        for (let i = 0; i < nights; i++) {
            const day = addDays(start, i);
            if (day < fromUtc || day >= toUtc) continue;
            const k = dateKey(day);
            counts[k] = (counts[k] || 0) + 1;
        }
    }
    return counts;
}

/**
 * Returns the daily availability for a hotel across [from, to).
 * Each entry: { date, booked, available, full }
 */
async function dailyAvailability(hotel, from, to, excludeBookingId = null) {
    const counts = await bookedCountByDay(hotel._id, from, to, excludeBookingId);
    const out = [];
    const start = toUtcMidnight(from);
    const end = toUtcMidnight(to);
    const total = hotel.roomCount || 10;
    for (let d = new Date(start); d < end; d = addDays(d, 1)) {
        const k = dateKey(d);
        const booked = counts[k] || 0;
        const available = Math.max(0, total - booked);
        out.push({ date: k, booked, available, full: available === 0 });
    }
    return out;
}

/**
 * Returns true if `hotel` can accommodate a booking that starts at `bookingDate`
 * and lasts `numOfNights` nights, given current bookings.
 */
async function hasAvailability(hotel, bookingDate, numOfNights, excludeBookingId = null) {
    const start = toUtcMidnight(bookingDate);
    const end = addDays(start, Math.max(1, numOfNights || 1));
    const daily = await dailyAvailability(hotel, start, end, excludeBookingId);
    return daily.every((d) => d.available > 0);
}

module.exports = {
    ACTIVE_STATUSES,
    toUtcMidnight,
    addDays,
    dateKey,
    bookedCountByDay,
    dailyAvailability,
    hasAvailability
};
