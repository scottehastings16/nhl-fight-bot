import { TwitterApi } from 'twitter-api-v2';

/**
 * Twitter API Client for posting fight alerts
 */
class TwitterClient {
  constructor() {
    this.client = null;
    this.isConfigured = false;
  }

  /**
   * Initialize Twitter client with API credentials
   * @param {Object} config - Twitter API credentials
   */
  initialize(config) {
    if (!config.apiKey || !config.apiSecret || !config.accessToken || !config.accessSecret) {
      console.warn('Twitter API credentials not fully configured. Tweets will be logged to console only.');
      this.isConfigured = false;
      return;
    }

    try {
      this.client = new TwitterApi({
        appKey: config.apiKey,
        appSecret: config.apiSecret,
        accessToken: config.accessToken,
        accessSecret: config.accessSecret,
      });

      this.isConfigured = true;
      console.log('✅ Twitter client initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Twitter client:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Post a tweet
   * @param {string} text - Tweet text (max 280 characters)
   * @returns {Promise<Object>} Tweet response
   */
  async tweet(text) {
    if (!this.isConfigured) {
      console.log('\n📢 [MOCK TWEET - Twitter not configured]');
      console.log('─'.repeat(60));
      console.log(text);
      console.log('─'.repeat(60));
      return { mock: true, text };
    }

    try {
      // Ensure tweet is under 280 characters
      if (text.length > 280) {
        text = text.substring(0, 277) + '...';
      }

      const response = await this.client.v2.tweet(text);
      console.log('✅ Tweet posted successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ Error posting tweet:', error.message);
      throw error;
    }
  }

  /**
   * Get random fight heading with hockey terminology
   * @returns {string} Random fight heading
   */
  getRandomFightHeading() {
    const headings = [
      '🥊 FIGHT! 🥊',
      '🥊 DROPPING THE GLOVES! 🥊',
      '🥊 TILT! 🥊',
      '🥊 SCRAP! 🥊',
      '🥊 THROWING HANDS! 🥊',
      '🥊 DONNYBROOK! 🥊',
      '🥊 HEAVYWEIGHT BOUT! 🥊',
      '🥊 ROUGHING IT UP! 🥊',
      '🥊 TIME TO DANCE! 🥊',
      '🥊 GLOVES OFF! 🥊'
    ];
    return headings[Math.floor(Math.random() * headings.length)];
  }

  /**
   * Format a fight into a tweet
   * @param {Object} fight - Fight object
   * @param {Object} gameInfo - Additional game information
   * @returns {string} Formatted tweet text
   */
  formatFightTweet(fight, gameInfo = {}) {
    let tweet = this.getRandomFightHeading() + '\n\n';

    // Players involved
    if (fight.isTwoManFight && fight.opponent) {
      tweet += `${fight.player.name} (${fight.player.team}) vs ${fight.opponent.name} (${fight.opponent.team})\n\n`;
    } else {
      tweet += `${fight.player.name} (${fight.player.team})\n\n`;
    }

    // Game situation
    const periodLabel = this.getPeriodLabel(fight.period, fight.periodType);
    tweet += `${periodLabel} ${fight.timeInPeriod}`;

    // Score
    const awayScore = fight.awayScore;
    const homeScore = fight.homeScore;
    tweet += ` | ${fight.awayTeam} ${awayScore}-${homeScore} ${fight.homeTeam}\n\n`;

    // Hashtags
    tweet += `#NHLFights #Hockey`;

    // Add team hashtags if available
    if (fight.player.team) {
      tweet += ` #${this.getTeamHashtag(fight.player.team)}`;
    }
    if (fight.opponent && fight.opponent.team && fight.opponent.team !== fight.player.team) {
      tweet += ` #${this.getTeamHashtag(fight.opponent.team)}`;
    }

    return tweet;
  }

  /**
   * Get period label (Q1, Q2, Q3, OT, SO)
   * @param {number} period - Period number
   * @param {string} periodType - Period type (REG, OT, SO)
   * @returns {string} Period label
   */
  getPeriodLabel(period, periodType) {
    if (periodType === 'OT') return 'OT';
    if (periodType === 'SO') return 'SO';
    return `P${period}`;
  }

  /**
   * Get team hashtag from abbreviation
   * @param {string} abbrev - Team abbreviation
   * @returns {string} Team hashtag
   */
  getTeamHashtag(abbrev) {
    const teamHashtags = {
      'ANA': 'Ducks',
      'BOS': 'Bruins',
      'BUF': 'Sabres',
      'CAR': 'Canes',
      'CBJ': 'BlueJackets',
      'CGY': 'Flames',
      'CHI': 'Blackhawks',
      'COL': 'Avs',
      'DAL': 'TexasHockey',
      'DET': 'RedWings',
      'EDM': 'Oilers',
      'FLA': 'FlaPanthers',
      'LAK': 'GoKingsGo',
      'MIN': 'MNWild',
      'MTL': 'GoHabsGo',
      'NJD': 'NJDevils',
      'NSH': 'Preds',
      'NYI': 'Isles',
      'NYR': 'NYR',
      'OTT': 'Sens',
      'PHI': 'Flyers',
      'PIT': 'LetsGoPens',
      'SEA': 'SeaKraken',
      'SJS': 'SJSharks',
      'STL': 'STLBlues',
      'TBL': 'GoBolts',
      'TOR': 'LeafsForever',
      'UTA': 'UtahHC',
      'VAN': 'Canucks',
      'VGK': 'VegasBorn',
      'WPG': 'GoJetsGo',
      'WSH': 'ALLCAPS'
    };

    return teamHashtags[abbrev] || abbrev;
  }
}

export default new TwitterClient();
