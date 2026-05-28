const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  res.json(rooms);
});

module.exports = router;
