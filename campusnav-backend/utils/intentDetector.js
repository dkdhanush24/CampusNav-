/**
 * Intent Detector for NLP Pipeline
 * Stage 3: Score-Based Intent Detection with Confidence
 * 
 * Design: Keyword scoring (not regex matching), ambiguity handling
 */

const { preprocess, tokenize } = require('./textUtils');
const { extractDesignation, extractDepartment, extractName, extractSubject } = require('./entityExtractor');

// ============================================
// INTENT DEFINITIONS
// Each intent has keywords that increase its score
// ============================================

const INTENT_KEYWORDS = {
  HOD_QUERY: {
    keywords: ['hod', 'head', 'heads', 'heading', 'incharge', 'in-charge'],
    weight: 3  // Strong indicator
  },
  DEAN_QUERY: {
    keywords: ['dean', 'academics', 'academic'],
    weight: 3
  },
  DESIGNATION_QUERY: {
    keywords: ['designation', 'role', 'position', 'post', 'title', 'rank', 'working'],
    weight: 2
  },
  FACULTY_LOOKUP: {
    keywords: ['who', 'name', 'contact', 'email', 'phone', 'details', 'info', 'about'],
    weight: 1  // Lower weight - common words
  },
  SUBJECT_QUERY: {
    keywords: ['teaches', 'teaching', 'subject', 'course', 'handles', 'handling'],
    weight: 3
  },
  LIST_FACULTY: {
    keywords: ['all', 'list', 'faculty', 'faculties', 'members', 'staff'],
    weight: 2
  },
  COUNT_QUERY: {
    keywords: ['count', 'many', 'number', 'total', 'how'],
    weight: 2
  },
  FACULTY_LOCATION: {
    keywords: ['where', 'location', 'room', 'cabin', 'office', 'sitting', 'find', 'currently', 'now', 'present'],
    weight: 3
  }
};

// Minimum confidence threshold (0-1 scale)
const CONFIDENCE_THRESHOLD = 0.3;

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Calculate intent scores based on keyword presence
 * 
 * @param {string} message - User message
 * @returns {Object} - Map of intent → score
 */
function calculateIntentScores(message) {
  if (!message) {
    return {};
  }

  const tokens = new Set(tokenize(message.toLowerCase()));
  const scores = {};

  for (const [intent, config] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;

    for (const keyword of config.keywords) {
      // Check exact token match
      if (tokens.has(keyword)) {
        score += config.weight;
      }
      // Also check substring containment for multi-word matches
      else if (message.toLowerCase().includes(keyword)) {
        score += config.weight * 0.5;  // Partial credit
      }
    }

    scores[intent] = score;
  }

  // Boost scores based on entity extraction
  const designation = extractDesignation(message);
  const department = extractDepartment(message);
  const name = extractName(message);
  const subject = extractSubject(message);

  // HOD detection boost
  if (designation === 'hod') {
    scores.HOD_QUERY = (scores.HOD_QUERY || 0) + 5;
  }

  // Dean detection boost
  if (designation === 'dean' || designation === 'dean_academics') {
    scores.DEAN_QUERY = (scores.DEAN_QUERY || 0) + 5;
  }

  // Name presence boosts faculty lookup
  if (name && name.length > 2) {
    scores.FACULTY_LOOKUP = (scores.FACULTY_LOOKUP || 0) + 3;
  }

  // Subject presence boosts subject query
  if (subject) {
    scores.SUBJECT_QUERY = (scores.SUBJECT_QUERY || 0) + 4;
  }

  // Department presence adds context (small boost to role queries)
  if (department) {
    if (scores.HOD_QUERY > 0) scores.HOD_QUERY += 1;
    if (scores.DEAN_QUERY > 0) scores.DEAN_QUERY += 1;
    if (scores.LIST_FACULTY > 0) scores.LIST_FACULTY += 1;
  }

  return scores;
}

/**
 * Get the highest scoring intent
 * 
 * @param {Object} scores - Intent score map
 * @returns {Object} - { intent, score, isAmbiguous }
 */
function getTopIntent(scores) {
  const entries = Object.entries(scores).filter(([_, score]) => score > 0);

  if (entries.length === 0) {
    return { intent: 'UNKNOWN', score: 0, isAmbiguous: false };
  }

  // Sort by score descending
  entries.sort((a, b) => b[1] - a[1]);

  const [topIntent, topScore] = entries[0];
  const secondScore = entries.length > 1 ? entries[1][1] : 0;

  // Check if scores are too close (ambiguous)
  const isAmbiguous = secondScore > 0 && (topScore - secondScore) < 2;

  return { intent: topIntent, score: topScore, isAmbiguous };
}

/**
 * Calculate confidence level (0-1)
 * 
 * @param {number} score - Intent score
 * @param {boolean} isAmbiguous - Whether intent is ambiguous
 * @returns {number} - Confidence between 0 and 1
 */
function calculateConfidence(score, isAmbiguous) {
  // Normalize score to 0-1 range (max expected score ~10)
  let confidence = Math.min(score / 10, 1);

  // Reduce confidence if ambiguous
  if (isAmbiguous) {
    confidence *= 0.7;
  }

  return Math.round(confidence * 100) / 100;  // Round to 2 decimals
}

/**
 * Main intent detection function
 * Returns intent with confidence and metadata
 * 
 * @param {string} message - User message
 * @returns {Object} - { intent, confidence, scores, isAmbiguous, needsClarification }
 */
function detectIntent(message) {
  if (!message || typeof message !== 'string') {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      scores: {},
      isAmbiguous: false,
      needsClarification: true
    };
  }

  const scores = calculateIntentScores(message);
  const { intent, score, isAmbiguous } = getTopIntent(scores);
  const confidence = calculateConfidence(score, isAmbiguous);

  return {
    intent,
    confidence,
    scores,
    isAmbiguous,
    needsClarification: confidence < CONFIDENCE_THRESHOLD
  };
}

/**
 * Legacy function - returns just intent string for backward compatibility
 * 
 * @param {string} message - User message  
 * @returns {string} - Intent name
 */
function detectIntentSimple(message) {
  return detectIntent(message).intent;
}

/**
 * Get clarification message for ambiguous queries
 * 
 * @param {Object} scores - Intent scores
 * @param {Object} entities - Extracted entities
 * @returns {string} - Clarification question
 */
function getClarificationMessage(scores, entities) {
  const topIntents = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([intent]) => intent);

  // Generate contextual clarification
  if (topIntents.includes('HOD_QUERY') && topIntents.includes('FACULTY_LOOKUP')) {
    return "Are you looking for the HOD of a department, or information about a specific faculty member?";
  }

  if (entities.department && !entities.designation) {
    return `I found ${entities.department} department. Are you looking for the HOD, faculty list, or a specific faculty member?`;
  }

  if (entities.name && entities.name.length > 2) {
    return `Are you looking for information about "${entities.name}"?`;
  }

  return "I'm not sure what you're looking for. Could you please specify if you want:\n- HOD/Dean information\n- Faculty member details\n- Department faculty list";
}

module.exports = {
  detectIntent,
  detectIntentSimple,
  calculateIntentScores,
  getTopIntent,
  calculateConfidence,
  getClarificationMessage,
  INTENT_KEYWORDS,
  CONFIDENCE_THRESHOLD
};
