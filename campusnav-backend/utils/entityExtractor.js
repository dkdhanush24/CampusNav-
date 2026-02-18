/**
 * Entity Extractor for NLP Pipeline
 * Stage 2: Semantic Token Mapping & Entity Extraction
 * 
 * Design: Substring-based fuzzy matching, no regex explosion
 */

const { preprocess, tokenize } = require('./textUtils');

// ============================================
// SEMANTIC DICTIONARIES
// Maps noisy/variant words → canonical meaning
// ============================================

/**
 * Department synonyms and variations
 * Key: canonical code, Value: array of variations (substrings to match)
 */
const DEPARTMENT_MAP = {
  'CSE': ['cse', 'cs', 'computer', 'computing', 'software', 'comp sci'],
  'ECE': ['ece', 'electronics and communication', 'electronics communication', 'ec'],
  'EEE': ['eee', 'electrical', 'ee', 'electric'],
  'ME': ['me', 'mechanical', 'mech'],
  'CE': ['ce', 'civil'],
  'IT': ['it', 'information technology', 'info tech'],
  'AIDS': ['aids', 'ai ds', 'artificial intelligence data science', 'ai and ds'],
  'MBA': ['mba', 'management', 'business'],
  'MCA': ['mca', 'computer applications']
};

/**
 * Designation/Role synonyms and variations
 * Key: canonical role, Value: array of variations
 */
const DESIGNATION_MAP = {
  'hod': ['hod', 'head', 'heads', 'heading', 'head of department', 'head of dept', 'h o d', 'incharge', 'in charge', 'in-charge'],
  'dean': ['dean', 'deen'],
  'dean_academics': ['dean academics', 'academic dean', 'dean academic', 'acadmics', 'acadmic'],
  'principal': ['principal', 'principle', 'princi'],
  'professor': ['prof', 'professor'],
  'associate_professor': ['associate professor', 'assoc prof', 'associate prof', 'asso prof'],
  'assistant_professor': ['assistant professor', 'asst prof', 'asst professor', 'assistant prof'],
  'lecturer': ['lecturer', 'lect']
};

/**
 * Query type indicators
 * Words that signal a specific type of query
 */
const QUERY_INDICATORS = {
  'faculty_lookup': ['name', 'contact', 'email', 'phone', 'details', 'info', 'who'],
  'department_query': ['dept', 'department', 'branch', 'stream'],
  'designation_query': ['designation', 'role', 'position', 'post', 'title', 'rank'],
  'count_query': ['count', 'how many', 'number', 'total']
};

// ============================================
// FUZZY MATCHING HELPERS
// ============================================

/**
 * Check if text contains any of the patterns (substring match)
 * More forgiving than exact regex match
 * 
 * @param {string} text - Text to search in
 * @param {string[]} patterns - Patterns to look for
 * @returns {boolean} - True if any pattern found
 */
function containsAny(text, patterns) {
  if (!text || !patterns) return false;
  const lowerText = text.toLowerCase();
  return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
}

/**
 * Find best matching key from a semantic map
 * Uses substring containment for fuzzy matching
 * 
 * @param {string} text - Text to analyze
 * @param {Object} semanticMap - Map of canonical → variations
 * @returns {string|null} - Canonical key or null
 */
function findSemanticMatch(text, semanticMap) {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const [canonical, variations] of Object.entries(semanticMap)) {
    for (const variant of variations) {
      if (lowerText.includes(variant)) {
        return canonical;
      }
    }
  }
  return null;
}

// ============================================
// ENTITY EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract department from message using semantic mapping
 * Tolerates misspellings via substring matching
 * 
 * @param {string} message - User message (raw or normalized)
 * @returns {string|null} - Department code or null
 */
function extractDepartment(message) {
  if (!message) return null;
  return findSemanticMatch(message, DEPARTMENT_MAP);
}

/**
 * Extract designation/role from message using semantic mapping
 * 
 * @param {string} message - User message
 * @returns {string|null} - Canonical designation or null
 */
function extractDesignation(message) {
  if (!message) return null;
  return findSemanticMatch(message, DESIGNATION_MAP);
}

/**
 * Extract subject from message
 * 
 * @param {string} message - User message
 * @returns {string|null} - Subject name or null
 */
function extractSubject(message) {
  if (!message) return null;

  const subjects = [
    'operating system', 'operating systems', 'os',
    'artificial intelligence', 'ai',
    'machine learning', 'ml',
    'data structures', 'ds', 'dsa',
    'automata', 'formal language', 'toc',
    'database', 'dbms', 'sql',
    'networking', 'computer networks', 'cn',
    'web development', 'web tech'
  ];

  const lowerMsg = message.toLowerCase();
  return subjects.find(s => lowerMsg.includes(s)) || null;
}

/**
 * Extract faculty name from message
 * Handles partial names, missing titles, reversed names
 * 
 * Strategy:
 * 1. Preprocess to remove stopwords
 * 2. Remove known semantic tokens (dept, designation words)
 * 3. Remaining tokens are likely name components
 * 
 * @param {string} message - User message
 * @returns {string|null} - Extracted name hint or null
 */
function extractName(message) {
  if (!message) return null;

  // Get cleaned tokens (stopwords already removed)
  const tokens = preprocess(message);

  // Words to exclude (semantic keywords, not names)
  const excludeWords = new Set([
    // Department keywords
    'cse', 'ece', 'eee', 'me', 'ce', 'it', 'mba', 'mca',
    'computer', 'science', 'electronics', 'electrical', 'mechanical', 'civil',
    'department', 'dept', 'branch',
    // Designation keywords
    'hod', 'head', 'dean', 'principal', 'professor', 'prof',
    'associate', 'assistant', 'asst', 'lecturer',
    'academics', 'academic',
    // Query words that might slip through
    'name', 'contact', 'email', 'details', 'info',
    'designation', 'role', 'position', 'post'
  ]);

  // Filter out semantic keywords
  const nameTokens = tokens.filter(token =>
    !excludeWords.has(token) &&
    token.length >= 2  // Name parts should be at least 2 chars
  );

  if (nameTokens.length === 0) return null;

  // Join remaining tokens as name
  const name = nameTokens.join(' ').trim();

  // Return null if too short to be a valid name
  return name.length >= 2 ? name : null;
}

/**
 * Extract all entities from a message
 * Returns an object with all detected entities
 * 
 * @param {string} message - User message
 * @returns {Object} - { department, designation, name, subject }
 */
function extractAllEntities(message) {
  return {
    department: extractDepartment(message),
    designation: extractDesignation(message),
    name: extractName(message),
    subject: extractSubject(message)
  };
}

/**
 * Check if a query is about a specific role/designation
 * 
 * @param {string} message - User message
 * @returns {boolean}
 */
function isRoleQuery(message) {
  return extractDesignation(message) !== null;
}

/**
 * Check if a query mentions a department
 * 
 * @param {string} message - User message
 * @returns {boolean}
 */
function hasDepartment(message) {
  return extractDepartment(message) !== null;
}

module.exports = {
  // Entity extraction
  extractDepartment,
  extractDesignation,
  extractName,
  extractSubject,
  extractAllEntities,

  // Helpers
  containsAny,
  findSemanticMatch,
  isRoleQuery,
  hasDepartment,

  // Expose maps for testing/debugging
  DEPARTMENT_MAP,
  DESIGNATION_MAP,
  QUERY_INDICATORS
};
