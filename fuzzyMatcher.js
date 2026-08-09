/**
 * String similarity and fuzzy matching module.
 * Implements Sørensen-Dice coefficient and normalized Levenshtein distance
 * to detect slot game titles with >= 60% similarity.
 */

function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Sørensen-Dice coefficient using character bigrams.
 */
function getBigrams(str) {
  const bigrams = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

function diceSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const bg of bigrams1) {
    if (bigrams2.has(bg)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

/**
 * Calculates Levenshtein Distance similarity (0.0 to 1.0).
 */
function levenshteinSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null)
  );

  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1.0 - (distance / maxLen);
}

/**
 * Combined similarity score weighting Dice (60%) and Levenshtein (40%).
 */
function calculateSimilarity(str1, str2) {
  const dice = diceSimilarity(str1, str2);
  const lev = levenshteinSimilarity(str1, str2);

  // If exact substring match or title prefix match, bump score higher
  const n1 = normalizeString(str1);
  const n2 = normalizeString(str2);
  let bonus = 0;
  if (n1.includes(n2) || n2.includes(n1)) {
    bonus = 0.15;
  }

  const combined = (dice * 0.5) + (lev * 0.5) + bonus;
  return Math.min(1.0, combined);
}

/**
 * Checks if inputted game title matches any existing entry in masterList by >= threshold (default 60%).
 * @param {string} inputGame 
 * @param {Array<{slotGame: string, username: string}>} masterList 
 * @param {number} threshold Default 0.60 (60%)
 */
function findSimilarGame(inputGame, masterList, threshold = 0.60) {
  if (!masterList || masterList.length === 0) {
    return { matchFound: false };
  }

  let highestMatch = null;
  let highestScore = 0;

  for (const entry of masterList) {
    const existingGame = entry.slotGame;
    const score = calculateSimilarity(inputGame, existingGame);

    if (score > highestScore) {
      highestScore = score;
      highestMatch = entry;
    }
  }

  if (highestScore >= threshold && highestMatch) {
    return {
      matchFound: true,
      matchedGame: highestMatch.slotGame,
      matchedUser: highestMatch.username,
      similarity: (highestScore * 100).toFixed(1) + '%'
    };
  }

  return { matchFound: false };
}

module.exports = {
  calculateSimilarity,
  findSimilarGame,
  normalizeString
};
