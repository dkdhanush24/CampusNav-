/**
 * Text Utilities for NLP Pipeline
 * Stage 1: Normalization, Tokenization, Stopword Removal
 * 
 * Design: Null-safe, deterministic, no external dependencies
 */

// ============================================
// STOPWORDS LIST
// Common words that add no semantic meaning
// ============================================
const STOPWORDS = new Set([
  // Question words
  'who', 'what', 'where', 'when', 'how', 'why', 'which',
  // Common verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'will', 'would', 'shall', 'should',
  // Articles & prepositions
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'with',
  // Pronouns
  'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'we', 'they',
  // Common filler words
  'please', 'tell', 'give', 'show', 'find', 'get', 'know', 'want',
  'about', 'some', 'any', 'this', 'that', 'these', 'those',
  // Polite words
  'sir', 'madam', 'maam', 'thanks', 'thank', 'kindly'
]);

// ============================================
// HONORIFICS TO REMOVE
// Titles that should be stripped from names
// ============================================
const HONORIFICS = [
  'dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss', 'shri', 'smt'
];

/**
 * Normalize text input for NLP processing
 * Aggressively cleans input for semantic analysis
 * 
 * @param {any} text - Input text (handles null/undefined safely)
 * @returns {string} - Normalized lowercase text
 */
function normalize(text) {
  // Null-safe: return empty string for invalid input
  if (!text || typeof text !== 'string') {
    return '';
  }

  let result = text
    .toLowerCase()                           // Lowercase everything
    .replace(/[''`]/g, '')                   // Remove apostrophes
    .replace(/[^a-z0-9\s]/g, ' ')            // Replace non-alphanumeric with space
    .replace(/\s+/g, ' ')                    // Collapse multiple spaces
    .trim();

  // Remove honorifics
  for (const hon of HONORIFICS) {
    // Match honorific followed by space or end, with optional dot
    result = result.replace(new RegExp(`\\b${hon}\\.?\\s*`, 'gi'), '');
  }

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Tokenize text into array of words
 * 
 * @param {string} text - Normalized text
 * @returns {string[]} - Array of tokens
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Remove stopwords from token array
 * 
 * @param {string[]} tokens - Array of tokens
 * @returns {string[]} - Tokens with stopwords removed
 */
function removeStopWords(tokens) {
  if (!Array.isArray(tokens)) {
    return [];
  }

  return tokens.filter(token => !STOPWORDS.has(token));
}

/**
 * Full preprocessing pipeline
 * Normalize → Tokenize → Remove Stopwords
 * 
 * @param {any} text - Raw input text
 * @returns {string[]} - Cleaned tokens ready for semantic analysis
 */
function preprocess(text) {
  const normalized = normalize(text);
  const tokens = tokenize(normalized);
  const cleaned = removeStopWords(tokens);
  return cleaned;
}

/**
 * Get normalized text with stopwords removed (as string)
 * 
 * @param {any} text - Raw input text
 * @returns {string} - Cleaned text as single string
 */
function getCleanedText(text) {
  return preprocess(text).join(' ');
}

module.exports = {
  normalize,
  tokenize,
  removeStopWords,
  preprocess,
  getCleanedText,
  STOPWORDS,
  HONORIFICS
};
