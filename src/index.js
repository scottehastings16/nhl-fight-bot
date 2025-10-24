import dotenv from 'dotenv';
import nhlApi from './nhlApi.js';
import fightDetector from './fightDetector.js';
import twitterClient from './twitterClient.js';
import storage from './storage.js';

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
   * Process a detected fight (check if new, tweet if needed)
   * @param {Object} fight - Fight object
   * @param {Object} game - Game object
   */
  async processFight(fight, game) {
    const fightId = fightDetector.createFightId(fight);

    // Check if we've already processed this fight
    if (storage.hasProcessed(fightId)) {
      console.log(`      ⏭️  Fight already processed (ID: ${fightId})`);
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

      // Mark as processed
      await storage.markProcessed(fightId);
      console.log(`      ✅ Fight processed and tweeted (ID: ${fightId})`);

    } catch (error) {
      console.error(`      ❌ Error processing fight:`, error.message);
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
