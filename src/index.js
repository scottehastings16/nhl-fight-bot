import dotenv from 'dotenv';
import cron from 'node-cron';
import nhlApi from './nhlApi.js';
import fightDetector from './fightDetector.js';
import twitterClient from './twitterClient.js';
import storage from './storage-enhanced.js';

// Load environment variables
dotenv.config();

/**
 * NHL Fights Twitter Bot
 * Monitors NHL games and tweets when fights occur
 */
class NHLFightsBot {
  constructor() {
    this.pollInterval = parseInt(process.env.POLL_INTERVAL) || 60000; // Default 1 minute
    this.isRunning = false;
    this.monitoringInterval = null;

    // Active hours configuration
    this.activeHoursStart = process.env.ACTIVE_HOURS_START ? parseInt(process.env.ACTIVE_HOURS_START) : null;
    this.activeHoursEnd = process.env.ACTIVE_HOURS_END ? parseInt(process.env.ACTIVE_HOURS_END) : null;
    this.timezone = process.env.TIMEZONE || 'America/Chicago';

    // Daily leaderboard configuration
    this.dailyLeaderboardEnabled = process.env.DAILY_LEADERBOARD_ENABLED !== 'false';
    this.dailyLeaderboardTime = process.env.DAILY_LEADERBOARD_TIME || '12:00'; // Default noon
  }

  /**
   * Initialize the bot
   */
  async initialize() {
    console.log('🏒 NHL Fights Twitter Bot Starting...\n');

    // Initialize storage
    await storage.initialize();

    // Initialize Twitter client
    twitterClient.initialize({
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    console.log(`⏱️  Poll interval: ${this.pollInterval / 1000} seconds\n`);

    // Set up daily leaderboard schedule
    if (this.dailyLeaderboardEnabled) {
      this.setupDailyLeaderboard();
    }

    console.log('─'.repeat(60));
  }

  /**
   * Start monitoring for fights
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Bot is already running');
      return;
    }

    this.isRunning = true;
    console.log('✅ Bot started. Monitoring for NHL fights...\n');

    // Run initial check immediately
    await this.checkForFights();

    // Set up interval for continuous monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.checkForFights();
    }, this.pollInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Bot stopped');
  }

  /**
   * Check if current time is within active hours
   * @returns {boolean}
   */
  isWithinActiveHours() {
    // If no active hours configured, run 24/7
    if (this.activeHoursStart === null || this.activeHoursEnd === null) {
      return true;
    }

    const now = new Date();
    const currentHour = parseInt(now.toLocaleString('en-US', {
      timeZone: this.timezone,
      hour: 'numeric',
      hour12: false
    }));

    // Handle time ranges that span midnight (e.g., 16-6 means 4pm-6am)
    if (this.activeHoursStart > this.activeHoursEnd) {
      // Active from start to midnight, OR midnight to end
      return currentHour >= this.activeHoursStart || currentHour < this.activeHoursEnd;
    } else {
      // Normal range within same day
      return currentHour >= this.activeHoursStart && currentHour < this.activeHoursEnd;
    }
  }

  /**
   * Check all active games for new fights
   */
  async checkForFights() {
    const timestamp = new Date().toLocaleString();

    // Check if we're within active hours
    if (!this.isWithinActiveHours()) {
      console.log(`\n⏸️  [${timestamp}] Outside active hours (${this.activeHoursStart}:00-${this.activeHoursEnd}:00 ${this.timezone}). Sleeping...`);
      return;
    }

    console.log(`\n🔍 [${timestamp}] Checking for fights...`);

    try {
      // Get all active games
      const activeGames = await nhlApi.getActiveGames();

      if (activeGames.length === 0) {
        console.log('   No active games found');
        return;
      }

      console.log(`   Found ${activeGames.length} active game(s)`);

      // Check each game for fights
      for (const game of activeGames) {
        await this.checkGameForFights(game);
      }

      // Periodic cleanup (every 100 checks, keep max 1000 fights)
      if (Math.random() < 0.01) {
        await storage.cleanup(1000);
      }

    } catch (error) {
      console.error('❌ Error checking for fights:', error.message);
    }
  }

  /**
   * Check a specific game for fights
   * @param {Object} game - Game object from NHL API
   */
  async checkGameForFights(game) {
    try {
      const gameId = game.id;
      const gameLabel = `${game.awayTeam.abbrev} @ ${game.homeTeam.abbrev}`;

      console.log(`   📊 Checking ${gameLabel} (${game.gameState})...`);

      // Get play-by-play data
      const playByPlayData = await nhlApi.getPlayByPlay(gameId);

      // Detect fights
      const fights = fightDetector.detectFights(playByPlayData);

      if (fights.length === 0) {
        console.log(`      No fights detected`);
        return;
      }

      console.log(`      🥊 Found ${fights.length} fight(s)!`);

      // Process each fight
      for (const fight of fights) {
        await this.processFight(fight, game);
      }

    } catch (error) {
      console.error(`   ❌ Error checking game ${game.id}:`, error.message);
    }
  }

  /**
   * Calculate elapsed time since fight occurred
   * @param {Object} fight - Fight object
   * @param {Object} game - Game object
   * @returns {number} Minutes elapsed since fight
   */
  getFightAge(fight, game) {
    // Estimate fight time based on period and time in period
    // This is approximate but good enough for filtering old fights
    const periodMinutes = (fight.period - 1) * 20; // Each period is 20 min
    const [minutes, seconds] = fight.timeInPeriod.split(':').map(Number);
    const fightMinute = periodMinutes + minutes;

    // Get current game time from game state
    const currentPeriod = game.periodDescriptor?.number || 1;
    const currentPeriodMinutes = (currentPeriod - 1) * 20;

    // Parse current time in period if available
    let currentMinute = currentPeriodMinutes;
    if (game.clock?.timeRemaining) {
      const [remMin, remSec] = game.clock.timeRemaining.split(':').map(Number);
      currentMinute = currentPeriodMinutes + (20 - remMin);
    }

    return currentMinute - fightMinute;
  }

  /**
   * Process a detected fight (check if new, tweet if needed)
   * @param {Object} fight - Fight object
   * @param {Object} game - Game object
   */
  async processFight(fight, game) {
    const fightId = fightDetector.createFightId(fight);

    // Skip fights older than 10 minutes (avoid re-processing old fights in active games)
    const fightAge = this.getFightAge(fight, game);
    if (fightAge > 10) {
      return;
    }

    // Check if we've already processed this fight
    if (storage.hasProcessed(fightId)) {
      // Silently skip already processed fights (no log spam)
      return;
    }

    console.log(`      🆕 New fight detected!`);

    // Log fight details
    if (fight.isTwoManFight && fight.opponent) {
      console.log(`         Players: ${fight.player.name} vs ${fight.opponent.name}`);
    } else {
      console.log(`         Player: ${fight.player.name}`);
    }
    console.log(`         Time: Period ${fight.period}, ${fight.timeInPeriod}`);
    console.log(`         Score: ${fight.awayTeam} ${fight.awayScore}-${fight.homeScore} ${fight.homeTeam}`);

    try {
      // Format and send tweet
      const tweetText = twitterClient.formatFightTweet(fight, game);
      await twitterClient.tweet(tweetText);

      // Get current season
      const season = this.getCurrentSeason();

      // Mark as processed with enhanced data for stats tracking
      await storage.markProcessed(fightId, {
        season: season,
        player: fight.player,
        opponent: fight.opponent,
        homeTeam: fight.homeTeam,
        awayTeam: fight.awayTeam
      });
      console.log(`      ✅ Fight processed and tweeted (ID: ${fightId})`);

    } catch (error) {
      console.error(`      ❌ Error processing fight:`, error.message);
    }
  }

  /**
   * Get current NHL season (e.g., "2025-2026")
   * @returns {string} Season string
   */
  getCurrentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (month >= 10) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  /**
   * Set up daily leaderboard schedule
   */
  setupDailyLeaderboard() {
    const [hour, minute] = this.dailyLeaderboardTime.split(':').map(Number);

    // Create cron expression (minute hour * * *)
    const cronExpression = `${minute} ${hour} * * *`;

    console.log(`📅 Daily leaderboard scheduled for ${this.dailyLeaderboardTime} ${this.timezone}`);

    // Schedule the job
    cron.schedule(cronExpression, async () => {
      console.log('\n📊 Running scheduled daily leaderboard...');
      await this.postDailyLeaderboard();
    }, {
      timezone: this.timezone
    });
  }

  /**
   * Post daily leaderboard tweet
   */
  async postDailyLeaderboard() {
    try {
      const season = this.getCurrentSeason();

      // Gather statistics
      const topFighters = storage.getTopFighters(season, 10);
      const topRivalries = storage.getTopTeamRivalries(season, 10);
      const weekCount = storage.getThisWeekCount(season);
      const seasonTotal = storage.getSeasonTotal(season);

      // Format and send tweet
      const tweetText = twitterClient.formatLeaderboardTweet({
        season,
        topFighters,
        topRivalries,
        weekCount,
        seasonTotal
      });

      await twitterClient.tweet(tweetText);
      console.log('✅ Daily leaderboard posted successfully\n');

    } catch (error) {
      console.error('❌ Error posting daily leaderboard:', error.message);
    }
  }

  /**
   * Display bot statistics
   */
  displayStats() {
    console.log('\n📊 Bot Statistics:');
    console.log(`   Total fights processed: ${storage.getProcessedCount()}`);
    console.log(`   Running: ${this.isRunning ? 'Yes' : 'No'}`);
    console.log(`   Poll interval: ${this.pollInterval / 1000}s\n`);
  }
}

// Initialize and start the bot
const bot = new NHLFightsBot();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down gracefully...');
  bot.stop();
  bot.displayStats();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Received SIGTERM, shutting down gracefully...');
  bot.stop();
  bot.displayStats();
  process.exit(0);
});

// Start the bot
(async () => {
  try {
    await bot.initialize();
    await bot.start();
  } catch (error) {
    console.error('❌ Fatal error starting bot:', error);
    process.exit(1);
  }
})();
