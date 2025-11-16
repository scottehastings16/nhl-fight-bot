import { TwitterApi } from 'twitter-api-v2';
import captainsManager from './captains.js';

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
   * @param {string} text - Tweet text
   * @param {Object} options - Tweet options
   * @param {boolean} options.skipCharacterLimit - Skip 280 character limit (for X Premium)
   * @returns {Promise<Object>} Tweet response
   */
  async tweet(text, options = {}) {
    const { skipCharacterLimit = false } = options;

    if (!this.isConfigured) {
      console.log('\n📢 [MOCK TWEET - Twitter not configured]');
      console.log('─'.repeat(60));
      console.log(text);
      console.log('─'.repeat(60));
      return { mock: true, text };
    }

    try {
      // Ensure tweet is under 280 characters (unless skipCharacterLimit is true)
      if (!skipCharacterLimit && text.length > 280) {
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

    // Check for captains first to determine if we should abbreviate names
    const player1IsCaptain = captainsManager.isCaptain(fight.player.id);
    const player2IsCaptain = fight.opponent ? captainsManager.isCaptain(fight.opponent.id) : false;
    const hasCaptain = player1IsCaptain || player2IsCaptain;

    // Log captain detection
    if (player1IsCaptain) {
      const team = captainsManager.getCaptainTeam(fight.player.id);
      console.log(`      🎖️  Captain detected: ${fight.player.name} (${team})`);
    }
    if (player2IsCaptain) {
      const team = captainsManager.getCaptainTeam(fight.opponent.id);
      console.log(`      🎖️  Captain detected: ${fight.opponent.name} (${team})`);
    }

    // Players involved (abbreviate names if a captain is involved)
    const player1Name = hasCaptain ? this.abbreviateName(fight.player.name) : fight.player.name;
    const player2Name = fight.opponent && hasCaptain ? this.abbreviateName(fight.opponent.name) : (fight.opponent ? fight.opponent.name : '');

    if (fight.isTwoManFight && fight.opponent) {
      tweet += `${player1Name} (${fight.player.team}) vs ${player2Name} (${fight.opponent.team})\n\n`;
    } else {
      tweet += `${player1Name} (${fight.player.team})\n\n`;
    }

    // Add special captain acknowledgment
    if (player1IsCaptain && player2IsCaptain) {
      // Both players are captains
      tweet += '⭐ CAPTAINS FACE OFF! ⭐\n\n';
    } else if (player1IsCaptain) {
      // Only player 1 is a captain
      const teamName = captainsManager.getCaptainTeam(fight.player.id);
      tweet += `⭐ ${teamName} captain in the fight! ⭐\n\n`;
    } else if (player2IsCaptain) {
      // Only player 2 is a captain
      const teamName = captainsManager.getCaptainTeam(fight.opponent.id);
      tweet += `⭐ ${teamName} captain in the fight! ⭐\n\n`;
    }

    // Game situation
    const periodLabel = this.getPeriodLabel(fight.period, fight.periodType);
    tweet += `${periodLabel} ${fight.timeInPeriod}\n\n`;

    // Hashtags
    tweet += `#NHLFights #NHL`;

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
   * Format daily leaderboard tweet
   * @param {Object} stats - Statistics object
   * @returns {string} Formatted tweet text
   */
  /**
   * Abbreviate first name (e.g., "Ryan Reaves" → "R. Reaves")
   */
  abbreviateName(fullName) {
    const parts = fullName.split(' ');
    if (parts.length < 2) return fullName;

    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return `${firstName.charAt(0)}. ${lastName}`;
  }

  formatLeaderboardTweet(stats) {
    const { season, topFighters, topRivalries, weekCount, seasonTotal } = stats;

    let tweet = '📊 SEASON LEADERBOARD\n\n';

    // Top 5 Fighters (with abbreviated first names)
    tweet += '🥊 FIGHTS:\n';
    topFighters.slice(0, 5).forEach((fighter, index) => {
      const shortName = this.abbreviateName(fighter.name);
      tweet += `${index + 1}. ${shortName} (${fighter.team}) ${fighter.fightCount}\n`;
    });

    // Top 3 Team Rivalries
    tweet += '\n🔥 TOP RIVALRIES:\n';
    topRivalries.slice(0, 3).forEach((rivalry, index) => {
      tweet += `${index + 1}. ${rivalry.teams} ${rivalry.fights}\n`;
    });

    // Stats summary
    tweet += `\n📅 Week: ${weekCount} | Season: ${seasonTotal}\n\n`;

    // Hashtags - start with base hashtags
    tweet += '#NHLFights #NHL';

    // Collect unique team abbreviations from top fighters and rivalries
    const teams = new Set();

    // Add teams from top fighters
    topFighters.slice(0, 5).forEach(fighter => {
      if (fighter.team) {
        teams.add(fighter.team);
      }
    });

    // Add teams from rivalries
    topRivalries.slice(0, 3).forEach(rivalry => {
      if (rivalry.teams) {
        // rivalry.teams format is like "BOS vs MTL" or "BOS-MTL"
        const teamAbbrevs = rivalry.teams.split(/\s*(?:vs|[-])\s*/);
        teamAbbrevs.forEach(team => {
          if (team && team.length === 3) {
            teams.add(team.trim());
          }
        });
      }
    });

    // Add team hashtags
    teams.forEach(team => {
      tweet += ` #${this.getTeamHashtag(team)}`;
    });

    return tweet;
  }

  /**
   * Get team hashtag from abbreviation
   * @param {string} abbrev - Team abbreviation
   * @returns {string} Team hashtag
   */
  getTeamHashtag(abbrev) {
    const teamHashtags = {
      'ANA': 'FlyTogether',
      'BOS': 'NHLBruins',
      'BUF': 'SabreHood',
      'CAR': 'RaiseUp',
      'CBJ': 'CBJ',
      'CGY': 'Flames',
      'CHI': 'Blackhawks',
      'COL': 'GoAvsGo',
      'DAL': 'TexasHockey',
      'DET': 'LGRW',
      'EDM': 'LetsGoOilers',
      'FLA': 'TimeToHunt',
      'LAK': 'GoKingsGo',
      'MIN': 'mnwild',
      'MTL': 'GoHabsGo',
      'NJD': 'NJDevils',
      'NSH': 'Smashville',
      'NYI': 'Isles',
      'NYR': 'NYR',
      'OTT': 'GoSensGo',
      'PHI': 'LetsGoFlyers',
      'PIT': 'LetsGoPens',
      'SEA': 'SeaKraken',
      'SJS': 'TheFutureIsTeal',
      'STL': 'stlblues',
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
