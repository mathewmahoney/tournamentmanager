/**
 * Stake.us Slot Game Database & Scraper Utility
 * Fetches and maintains a curated list of top Stake.us slot games, providers,
 * and bonus types (Normal vs Super Bonus).
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'slots_database.json');

// Pre-populated initial database of top Stake.us slots across major providers
const initialSlotDatabase = [
  // Pragmatic Play
  { title: "Sweet Bonanza 1000", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: true },
  { title: "Sweet Bonanza", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Gates of Olympus 1000", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: true },
  { title: "Gates of Olympus", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Sugar Rush 1000", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: true },
  { title: "Sugar Rush", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Big Bass Splash", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Big Bass Bonanza", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Big Bass Floats My Boat", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: true },
  { title: "Starlight Princess 1000", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: true },
  { title: "Starlight Princess", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Madame Destiny Megaways", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "The Dog House Megaways", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Fruit Party", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Fruit Party 2", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Cleocatra", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Wild West Gold Megaways", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },
  { title: "Gems Bonanza", provider: "Pragmatic Play", category: "Slots", hasSuperBonus: false },

  // Hacksaw Gaming
  { title: "Wanted Dead or a Wild", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Chaos Crew 2", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Chaos Crew", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: false },
  { title: "Dork Unit", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "RIP City", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Rotten", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Beam Boys", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Stack 'Em", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: false },
  { title: "Le Bandit", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Hand of Anubis", provider: "Hacksaw Gaming", category: "Slots", hasSuperBonus: true },

  // Nolimit City
  { title: "San Quentin xWays", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },
  { title: "Mental", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },
  { title: "Tombstone RIP", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },
  { title: "Fire in the Hole 2", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },
  { title: "Fire in the Hole", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },
  { title: "Das xBoot", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },
  { title: "Dead Canary", provider: "Nolimit City", category: "Slots", hasSuperBonus: true },

  // Push Gaming
  { title: "Razor Returns", provider: "Push Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Razor Shark", provider: "Push Gaming", category: "Slots", hasSuperBonus: false },
  { title: "Big Bamboo", provider: "Push Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Jammin' Jars", provider: "Push Gaming", category: "Slots", hasSuperBonus: false },

  // Relax Gaming
  { title: "Money Train 4", provider: "Relax Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Money Train 3", provider: "Relax Gaming", category: "Slots", hasSuperBonus: true },
  { title: "Money Train 2", provider: "Relax Gaming", category: "Slots", hasSuperBonus: false },
  { title: "Temple Tumble Megaways", provider: "Relax Gaming", category: "Slots", hasSuperBonus: false }
];

function loadSlots() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading slots database:', err);
  }
  saveSlots(initialSlotDatabase);
  return initialSlotDatabase;
}

function saveSlots(slots) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(slots, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving slots database:', err);
  }
}

/**
 * Searches slots matching query string and excluding already claimed games
 * @param {string} query 
 * @param {Array<string>} claimedGames Array of lowercased claimed game titles
 * @param {number} limit Max results to return (max 25 for Discord autocomplete)
 */
function searchSlots(query = '', claimedGames = [], limit = 25) {
  const slots = loadSlots();
  const normalizedQuery = query.trim().toLowerCase();
  const claimedSet = new Set(claimedGames.map(g => g.trim().toLowerCase()));

  const filtered = slots.filter(slot => {
    const titleLower = slot.title.toLowerCase();
    // Exclude if already claimed
    if (claimedSet.has(titleLower)) return false;

    if (!normalizedQuery) return true;
    return titleLower.includes(normalizedQuery) || slot.provider.toLowerCase().includes(normalizedQuery);
  });

  return filtered.slice(0, limit);
}

module.exports = {
  loadSlots,
  saveSlots,
  searchSlots
};
