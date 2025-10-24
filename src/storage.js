import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * JSON file storage for tracking processed fights and player stats
 */
class Storage {
  constructor() {
    this.filePath = path.join(__dirname, '..', 'fights.json');
    this.fights = new Set();
    this.playerStats = {}; // { season: { playerId: { name, team, fightCount } } }
  }

  /**
   * Initialize storage by loading existing fight data
   */
  async initialize() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const stored = JSON.parse(data);

      this.fights = new Set(stored.fights || []);
      this.playerStats = stored.playerStats || {};

      console.log(`✅ Loaded ${this.fights.size} processed fights from storage`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start fresh
        console.log('📁 No existing fight data found. Starting fresh.');
        this.fights = new Set();
        this.playerStats = {};
        await this.save();
      } else {
        console.error('❌ Error loading fight data:', error.message);
        this.fights = new Set();
        this.playerStats = {};
      }
    }
  }

  /**
   * Check if a fight has already been processed
   * @param {string} fightId - Unique fight identifier
   * @returns {boolean}
   */
  hasProcessed(fightId) {
    return this.fights.has(fightId);
  }

  /**
   * Get fight count for a player this season
   * @param {number} playerId - Player ID
   * @param {string} season - Season string (e.g., "2024-2025")
   * @returns {number} Number of fights this season
   */
  getPlayerFightCount(playerId, season) {
    if (!playerId || !season) return 0;
    return this.playerStats[season]?.[playerId]?.fightCount || 0;
  }

  /**
   * Record a fight and update player stats
   * @param {string} fightId - Unique fight identifier
   * @param {Object} fightData - Fight data including player info
   */
  async markProcessed(fightId, fightData = {}) {
    this.fights.add(fightId);

    // Update player fight counts if player data provided
    if (fightData.season && fightData.player) {
      const season = fightData.season;

      if (!this.playerStats[season]) {
        this.playerStats[season] = {};
      }

      // Update main player
      if (fightData.player.id) {
        if (!this.playerStats[season][fightData.player.id]) {
          this.playerStats[season][fightData.player.id] = {
            name: fightData.player.name,
            team: fightData.player.team,
            fightCount: 0
          };
        }
        this.playerStats[season][fightData.player.id].fightCount++;
      }

      // Update opponent if it's a two-man fight
      if (fightData.opponent && fightData.opponent.id) {
        if (!this.playerStats[season][fightData.opponent.id]) {
          this.playerStats[season][fightData.opponent.id] = {
            name: fightData.opponent.name,
            team: fightData.opponent.team,
            fightCount: 0
          };
        }
        this.playerStats[season][fightData.opponent.id].fightCount++;
      }
    }

    await this.save();
  }

  /**
   * Save fights and stats to disk
   */
  async save() {
    try {
      const data = JSON.stringify({
        fights: Array.from(this.fights),
        playerStats: this.playerStats
      }, null, 2);
      await fs.writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      console.error('❌ Error saving fight data:', error.message);
    }
  }

  /**
   * Get total number of processed fights
   * @returns {number}
   */
  getProcessedCount() {
    return this.fights.size;
  }

  /**
   * Clear old fight data (optional cleanup)
   */
  async cleanup(maxEntries = 1000) {
    if (this.fights.size > maxEntries) {
      const fightArray = Array.from(this.fights);
      const keep = fightArray.slice(-maxEntries);
      this.fights = new Set(keep);
      await this.save();
      console.log(`🧹 Cleaned up old fight data. Kept ${maxEntries} most recent entries.`);
    }
  }
}

export default new Storage();
