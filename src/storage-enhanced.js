import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced JSON file storage for tracking fights with comprehensive stats
 */
class Storage {
  constructor() {
    // Use persistent volume in production (Railway), local file in development
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
    this.filePath = path.join(dataDir, 'fights.json');
    this.fights = new Set();
    this.playerStats = {}; // { season: { playerId: { name, team, fightCount } } }
    this.rivalries = {}; // { season: { "Player1-vs-Player2": { count, lastFight: date } } }
    this.teamRivalries = {}; // { season: { "TOR-vs-BOS": { fights } } }
    this.weeklyStats = {}; // { season: { "2025-W42": { count, fights: [] } } }
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
      this.rivalries = stored.rivalries || {};
      this.teamRivalries = stored.teamRivalries || {};
      this.weeklyStats = stored.weeklyStats || {};

      console.log(`✅ Loaded ${this.fights.size} processed fights from storage`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📁 No existing fight data found. Starting fresh.');
        this.fights = new Set();
        this.playerStats = {};
        this.rivalries = {};
        this.teamRivalries = {};
        this.weeklyStats = {};
        await this.save();
      } else {
        console.error('❌ Error loading fight data:', error.message);
        this.fights = new Set();
        this.playerStats = {};
        this.rivalries = {};
        this.teamRivalries = {};
        this.weeklyStats = {};
      }
    }
  }

  /**
   * Check if a fight has already been processed
   */
  hasProcessed(fightId) {
    return this.fights.has(fightId);
  }

  /**
   * Get week string (e.g., "2025-W42")
   */
  getWeekString(date = new Date()) {
    const year = date.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Mark a fight as processed and update all stats
   */
  async markProcessed(fightId, fightData = {}) {
    this.fights.add(fightId);

    if (!fightData.season || !fightData.player) {
      await this.save();
      return;
    }

    const season = fightData.season;
    // Use the fight's actual date if provided, otherwise use current date
    const fightDate = fightData.date ? new Date(fightData.date) : new Date();
    const weekString = this.getWeekString(fightDate);

    // Initialize season data
    if (!this.playerStats[season]) this.playerStats[season] = {};
    if (!this.rivalries[season]) this.rivalries[season] = {};
    if (!this.teamRivalries[season]) this.teamRivalries[season] = {};
    if (!this.weeklyStats[season]) this.weeklyStats[season] = {};
    if (!this.weeklyStats[season][weekString]) {
      this.weeklyStats[season][weekString] = { count: 0, fights: [] };
    }

    // Update player stats
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

    if (fightData.opponent && fightData.opponent.id) {
      if (!this.playerStats[season][fightData.opponent.id]) {
        this.playerStats[season][fightData.opponent.id] = {
          name: fightData.opponent.name,
          team: fightData.opponent.team,
          fightCount: 0
        };
      }
      this.playerStats[season][fightData.opponent.id].fightCount++;

      // Update player rivalry
      const rivalryKey = this.getRivalryKey(
        fightData.player.name,
        fightData.opponent.name
      );

      if (!this.rivalries[season][rivalryKey]) {
        this.rivalries[season][rivalryKey] = { count: 0, lastFight: null };
      }
      this.rivalries[season][rivalryKey].count++;
      this.rivalries[season][rivalryKey].lastFight = new Date().toISOString();
    }

    // Update team rivalry
    if (fightData.homeTeam && fightData.awayTeam) {
      const teamRivalryKey = this.getTeamRivalryKey(fightData.homeTeam, fightData.awayTeam);

      if (!this.teamRivalries[season][teamRivalryKey]) {
        this.teamRivalries[season][teamRivalryKey] = { fights: 0 };
      }
      this.teamRivalries[season][teamRivalryKey].fights++;
    }

    // Update weekly stats
    this.weeklyStats[season][weekString].count++;
    this.weeklyStats[season][weekString].fights.push({
      players: fightData.opponent ?
        `${fightData.player.name} vs ${fightData.opponent.name}` :
        fightData.player.name,
      teams: `${fightData.awayTeam} @ ${fightData.homeTeam}`
    });

    await this.save();
  }

  /**
   * Get rivalry key (alphabetically sorted to avoid duplicates)
   */
  getRivalryKey(player1, player2) {
    return [player1, player2].sort().join('-vs-');
  }

  /**
   * Get team rivalry key (alphabetically sorted)
   */
  getTeamRivalryKey(team1, team2) {
    return [team1, team2].sort().join('-vs-');
  }

  /**
   * Check rivalry count between two players
   */
  getRivalryCount(player1, player2, season) {
    const key = this.getRivalryKey(player1, player2);
    return this.rivalries[season]?.[key]?.count || 0;
  }

  /**
   * Get team rivalry count
   */
  getTeamRivalryCount(team1, team2, season) {
    const key = this.getTeamRivalryKey(team1, team2);
    return this.teamRivalries[season]?.[key]?.fights || 0;
  }

  /**
   * Get top player fighters for a season
   */
  getTopFighters(season, limit = 10) {
    const players = this.playerStats[season] || {};
    return Object.entries(players)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.fightCount - a.fightCount)
      .slice(0, limit);
  }

  /**
   * Get top team rivalries
   */
  getTopTeamRivalries(season, limit = 10) {
    const rivalries = this.teamRivalries[season] || {};
    return Object.entries(rivalries)
      .map(([teams, data]) => ({ teams, ...data }))
      .sort((a, b) => b.fights - a.fights)
      .slice(0, limit);
  }

  /**
   * Get this week's fight count
   */
  getThisWeekCount(season) {
    const weekString = this.getWeekString();
    return this.weeklyStats[season]?.[weekString]?.count || 0;
  }

  /**
   * Save fights to disk
   */
  async save() {
    try {
      const data = JSON.stringify({
        fights: Array.from(this.fights),
        playerStats: this.playerStats,
        rivalries: this.rivalries,
        teamRivalries: this.teamRivalries,
        weeklyStats: this.weeklyStats
      }, null, 2);
      await fs.writeFile(this.filePath, data, 'utf-8');
    } catch (error) {
      console.error('❌ Error saving fight data:', error.message);
    }
  }

  /**
   * Get total number of processed fights
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
