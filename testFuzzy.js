const { calculateSimilarity, findSimilarGame } = require('./fuzzyMatcher');

console.log("=== Testing Fuzzy Matcher Algorithm ===");

const masterList = [
  { slotGame: "Sweet Bonanza 1000", username: "@Player1" },
  { slotGame: "Gates of Olympus", username: "@Player2" },
  { slotGame: "Wanted Dead or a Wild", username: "@Player3" }
];

const testCases = [
  { input: "Sweet Bonanza", expectedMatch: true, note: "Variant of Sweet Bonanza 1000" },
  { input: "gates of olympus", expectedMatch: true, note: "Case insensitive match" },
  { input: "Gates of Olympus 1000", expectedMatch: true, note: "Variant of Gates of Olympus" },
  { input: "Sugar Rush 1000", expectedMatch: false, note: "Completely different game" },
  { input: "Wanted Dead or Alive", expectedMatch: true, note: "Close typo / similar title" },
  { input: "Big Bass Splash", expectedMatch: false, note: "Completely different game" }
];

testCases.forEach(tc => {
  const result = findSimilarGame(tc.input, masterList, 0.60);
  console.log(`Input: "${tc.input}" (${tc.note})`);
  console.log(`  Match Found: ${result.matchFound}`);
  if (result.matchFound) {
    console.log(`  Matched Game: "${result.matchedGame}" by ${result.matchedUser} (${result.similarity})`);
  }
  console.log(`  Expected Match: ${tc.expectedMatch} -> ${result.matchFound === tc.expectedMatch ? "PASSED" : "FAILED"}\n`);
});
