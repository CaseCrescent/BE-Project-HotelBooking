const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');

exports.getHotels = async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // เปลี่ยนชื่อจาก Hospital เป็น Hotel และเปลี่ยนจาก appointments เป็น bookings
  query = Hotel.find(JSON.parse(queryStr)).populate('bookings');

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }
   // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Hotel.countDocuments();

  query = query.skip(startIndex).limit(limit);

  try {
    const hotels = await query;
    const pagination = {};

    if (endIndex < total) {
      pagination.next = { page: page + 1, limit };
    }

    if (startIndex > 0) {
      pagination.prev = { page: page - 1, limit };
    }

    res.status(200).json({ success: true, count: hotels.length, pagination, data: hotels });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

exports.getHotel = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(400).json({ success: false });
    }
    res.status(200).json({ success: true, data: hotel });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

exports.createHotel = async (req, res, next) => {
  try {
        const hotel = await Hotel.create(req.body);
        res.status(201).json({
            success: true,
            data: hotel
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateHotel = async (req, res, next) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!hotel) {
      return res.status(400).json({ success: false });
    }
    res.status(200).json({ success: true, data: hotel });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

exports.deleteHotel = async (req, res, next) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: `Hotel not found with id of ${req.params.id}` });
    }
    // ลบข้อมูลออก
    await hotel.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    console.log(err.stack);
    res.status(400).json({ success: false });
  }
};