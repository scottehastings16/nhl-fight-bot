import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple JSON file storage for tracking processed fights
 */
class Storage {
  constructor() {
    this.filePath = path.join(__dirname, '..', 'fights.json');
    this.fights = new Set();
  }

  /**
   * Initialize storage by loading existing fight data
   */
  async initialize() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const fightIds = JSON.parse(data);
      this.fights = new Set(fightIds);
      console.log(`✅ Loaded ${this.fights.size} processed fights from storage`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start fresh
        console.log('📁 No existing fight data found. Starting fresh.');
        this.fights = new Set();
        await this.save();
      } else {
        console.error('❌ Error loading fight data:', error.message);
        this.fights = new Set();
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
   * Mark a fight as processed
   * @param {string} fightId - Unique fight identifier
   */
  async markProcessed(fightId) {
    this.fights.add(fightId);
    await this.save();
  }

  /**
   * Save fights to disk
   */
  async save() {
    try {
      const data = JSON.stringify(Array.from(this.fights), null, 2);
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
   * Clear old fight data (optional cleanup - keep last 7 days worth)
   * Note: This is a simple implementation. In production, you might want
   * to store timestamps and clean up based on date.
   */
  async cleanup(maxEntries = 1000) {
    if (this.fights.size > maxEntries) {
      const fightArray = Array.from(this.fights);
      // Keep most recent entries (assuming they're added chronologically)
      const keep = fightArray.slice(-maxEntries);
      this.fights = new Set(keep);
      await this.save();
      console.log(`🧹 Cleaned up old fight data. Kept ${maxEntries} most recent entries.`);
    }
  }
}

export default new Storage();
