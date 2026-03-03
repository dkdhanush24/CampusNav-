/**
 * Stop Routes — CampusNav
 * GET /api/bus/:busId/stops
 */

const express = require("express");
const router = express.Router();
const { getStopsByBusId } = require("../controllers/stopController");

router.get("/:busId/stops", getStopsByBusId);

module.exports = router;
