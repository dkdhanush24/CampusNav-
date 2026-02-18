/**
 * Chat Route — LLM-Powered Chatbot Endpoint
 * 
 * POST /api/chat
 * Request:  { "message": "Where is Dr. Mubarak?" }
 * Response: { "reply": "Dr. Mubarak is currently in Room A203." }
 */

const express = require("express");
const router = express.Router();
const { handleChat } = require("../controllers/chatController");

// POST /api/chat — Main chatbot endpoint
router.post("/", handleChat);

module.exports = router;
