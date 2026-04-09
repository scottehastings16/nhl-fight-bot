import fetch from 'node-fetch';

const NHL_API_BASE = 'https://api-web.nhle.com';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * NHL API Client for fetching game data and play-by-play information
 */
class NHLApi {
  /**
   * Fetch with automatic retry on 5xx errors and network failures.
   * Uses exponential backoff: 500ms, 1000ms, 2000ms.
   */
  async _fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url);

        if (response.ok) {
          return await response.json();
        }

        if (response.status >= 500 && attempt < retries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`NHL API returned ${response.status} for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw new Error(`NHL API error: ${response.status} ${response.statusText}`);
      } catch (error) {
        const isRetryable = !error.message.startsWith('NHL API error:');
        if (isRetryable && attempt < retries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Network error for ${url}: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Get current/today's games with scores
   * @returns {Promise<Object>} Score data including all games for today
   */
  async getCurrentGames() {
    try {
      return await this._fetchWithRetry(`${NHL_API_BASE}/v1/score/now`);
    } catch (error) {
      console.error('Error fetching current games:', error.message);
      throw error;
    }
  }

  /**
   * Get play-by-play data for a specific game
   * @param {number} gameId - The NHL game ID
   * @returns {Promise<Object>} Play-by-play data including all events
   */
  async getPlayByPlay(gameId) {
    try {
      return await this._fetchWithRetry(`${NHL_API_BASE}/v1/gamecenter/${gameId}/play-by-play`);
    } catch (error) {
      console.error(`Error fetching play-by-play for game ${gameId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get boxscore data for a specific game
   * @param {number} gameId - The NHL game ID
   * @returns {Promise<Object>} Boxscore data
   */
  async getBoxscore(gameId) {
    try {
      return await this._fetchWithRetry(`${NHL_API_BASE}/v1/gamecenter/${gameId}/boxscore`);
    } catch (error) {
      console.error(`Error fetching boxscore for game ${gameId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all active (in-progress) games
   * @returns {Promise<Array>} Array of active games
   */
  async getActiveGames() {
    const scoreData = await this.getCurrentGames();

    if (!scoreData.games) {
      return [];
    }

    // Filter for games that are currently in progress
    return scoreData.games.filter(game => {
      const state = game.gameState;
      // Game states: FUT (future), LIVE, FINAL, OFF, CRIT
      return state === 'LIVE' || state === 'CRIT';
    });
  }
}

export default new NHLApi();
