const express = require('express');
const { findEarliest } = require('../controllers/availability');

const router = express.Router();

router.get('/find', findEarliest);

module.exports = router;
