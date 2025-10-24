import fetch from 'node-fetch';

const NHL_API_BASE = 'https://api-web.nhle.com';

/**
 * NHL API Client for fetching game data and play-by-play information
 */
class NHLApi {
  /**
   * Get current/today's games with scores
   * @returns {Promise<Object>} Score data including all games for today
   */
  async getCurrentGames() {
    try {
      const response = await fetch(`${NHL_API_BASE}/v1/score/now`);
      if (!response.ok) {
        throw new Error(`NHL API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
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
      const response = await fetch(`${NHL_API_BASE}/v1/gamecenter/${gameId}/play-by-play`);
      if (!response.ok) {
        throw new Error(`NHL API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
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
      const response = await fetch(`${NHL_API_BASE}/v1/gamecenter/${gameId}/boxscore`);
      if (!response.ok) {
        throw new Error(`NHL API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
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
