/**
 * Detects fights from NHL play-by-play data
 */
class FightDetector {
  /**
   * Extract all fights from play-by-play data
   * @param {Object} playByPlayData - Play-by-play data from NHL API
   * @returns {Array} Array of fight objects
   */
  detectFights(playByPlayData) {
    if (!playByPlayData.plays) {
      return [];
    }

    const fights = [];
    const penalties = playByPlayData.plays.filter(play => play.typeDescKey === 'penalty');

    // Iterate through all penalties
    penalties.forEach(play => {
      // Check if it's a fighting penalty
      const isFight = this.isFightingPenalty(play);

      if (isFight) {
        const fightInfo = this.extractFightInfo(play, playByPlayData);
        fights.push(fightInfo);
      }
    });

    // Also detect roughing penalties that have matching misconducts (alternate fight classification)
    const roughingFights = this.detectRoughingFights(penalties, playByPlayData);
    fights.push(...roughingFights);

    // Group simultaneous fighting penalties (both players in a fight)
    return this.groupFights(fights);
  }

  /**
   * Check if a penalty is a fighting penalty
   * @param {Object} play - Play object
   * @returns {boolean}
   */
  isFightingPenalty(play) {
    if (!play.details) return false;

    const penaltyType = play.details.descKey?.toLowerCase() || '';
    const reason = play.details.reason?.toLowerCase() || '';

    // Common fighting penalty descriptors
    return penaltyType.includes('fighting') ||
           reason.includes('fighting') ||
           penaltyType === 'fight';
  }

  /**
   * Detect fights that are classified as roughing + misconduct
   * Sometimes fights are recorded as roughing penalties with matching misconducts
   * @param {Array} penalties - Array of all penalty plays
   * @param {Object} playByPlayData - Full play-by-play data
   * @returns {Array} Array of detected fights
   */
  detectRoughingFights(penalties, playByPlayData) {
    const fights = [];
    const processedPlayers = new Set(); // Track player-time combos to avoid duplicates

    penalties.forEach((penalty, index) => {
      // Look for roughing penalties
      const penaltyType = penalty.details?.descKey?.toLowerCase() || '';
      if (penaltyType !== 'roughing') return;

      const playerId = penalty.details?.committedByPlayerId;
      const period = penalty.periodDescriptor?.number;
      const timeInPeriod = penalty.timeInPeriod;

      // Create unique key for this player at this time
      const playerKey = `${playerId}-${period}-${timeInPeriod}`;
      if (processedPlayers.has(playerKey)) return; // Already processed this player

      // Check if this player has a misconduct penalty at the same time
      const hasMisconduct = penalties.some((other) => {
        const otherType = other.details?.descKey?.toLowerCase() || '';
        const otherPlayerId = other.details?.committedByPlayerId;
        const otherPeriod = other.periodDescriptor?.number;
        const otherTime = other.timeInPeriod;

        return otherType === 'misconduct' &&
               otherPlayerId === playerId &&
               otherPeriod === period &&
               otherTime === timeInPeriod;
      });

      // If roughing + misconduct, treat it as a fight
      if (hasMisconduct) {
        processedPlayers.add(playerKey);
        const fightInfo = this.extractFightInfo(penalty, playByPlayData);
        fights.push(fightInfo);
      }
    });

    return fights;
  }

  /**
   * Extract fight information from a penalty play
   * @param {Object} play - Penalty play object
   * @param {Object} playByPlayData - Full play-by-play data for context
   * @returns {Object} Fight information
   */
  extractFightInfo(play, playByPlayData) {
    const details = play.details || {};
    const timeInPeriod = play.timeInPeriod || '00:00';
    const period = play.periodDescriptor?.number || 1;
    const periodType = play.periodDescriptor?.periodType || 'REG';

    // Get player info from roster
    // Note: rosterSpots is indexed by position, need to find by playerId
    const playerId = details.committedByPlayerId;
    let playerInfo = null;
    if (playByPlayData.rosterSpots && playerId) {
      playerInfo = Object.values(playByPlayData.rosterSpots).find(
        player => player.playerId === playerId
      );
    }
    const playerName = playerInfo ?
      `${playerInfo.firstName?.default || ''} ${playerInfo.lastName?.default || ''}`.trim() :
      'Unknown';

    // Get team abbreviation
    const playerTeamId = details.eventOwnerTeamId;
    let teamAbbrev = '';
    if (playerTeamId === playByPlayData.homeTeam?.id) {
      teamAbbrev = playByPlayData.homeTeam?.abbrev || '';
    } else if (playerTeamId === playByPlayData.awayTeam?.id) {
      teamAbbrev = playByPlayData.awayTeam?.abbrev || '';
    }

    return {
      eventId: play.eventId,
      gameId: playByPlayData.id,
      period: period,
      periodType: periodType,
      timeInPeriod: timeInPeriod,
      timeRemaining: play.timeRemaining || timeInPeriod,
      player: {
        id: playerId,
        name: playerName,
        team: teamAbbrev
      },
      penaltyType: details.descKey || 'fighting',
      duration: details.duration || 5,
      homeTeam: playByPlayData.homeTeam?.abbrev || '',
      awayTeam: playByPlayData.awayTeam?.abbrev || '',
      homeScore: play.details?.homeScore || 0,
      awayScore: play.details?.awayScore || 0
    };
  }

  /**
   * Convert time string (MM:SS) to seconds
   * @param {string} timeString - Time in format "MM:SS"
   * @returns {number} Time in seconds
   */
  timeToSeconds(timeString) {
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes * 60 + seconds;
  }

  /**
   * Group simultaneous fighting penalties (typically 2 players fighting each other)
   * @param {Array} fights - Array of individual fight penalties
   * @returns {Array} Array of grouped fights
   */
  groupFights(fights) {
    const grouped = [];
    const processed = new Set();

    fights.forEach((fight, index) => {
      if (processed.has(index)) return;

      // Look for matching fight at same time (within 5 seconds and same period)
      const fightTime = this.timeToSeconds(fight.timeInPeriod);
      const matchingFight = fights.find((other, otherIndex) => {
        if (otherIndex === index || processed.has(otherIndex)) return false;
        if (other.period !== fight.period) return false;

        // Make sure it's a different player (prevent self-fights)
        if (other.player.id === fight.player.id) return false;

        // Allow fights within 5 seconds of each other to be grouped
        const otherTime = this.timeToSeconds(other.timeInPeriod);
        const timeDiff = Math.abs(fightTime - otherTime);
        return timeDiff <= 5;
      });

      if (matchingFight) {
        // Found a matching fight - group them
        processed.add(index);
        processed.add(fights.indexOf(matchingFight));

        grouped.push({
          ...fight,
          opponent: {
            ...matchingFight.player,
            eventId: matchingFight.eventId  // Include eventId for duplicate detection
          },
          isTwoManFight: true
        });
      } else {
        // Single fighting penalty
        processed.add(index);
        grouped.push({
          ...fight,
          isTwoManFight: false
        });
      }
    });

    return grouped;
  }

  /**
   * Create a unique identifier for a fight to prevent duplicates
   * For two-man fights, use the lower eventId to ensure both players map to same ID
   * @param {Object} fight - Fight object
   * @returns {string} Unique fight ID
   */
  createFightId(fight) {
    if (fight.isTwoManFight && fight.opponent && fight.opponent.eventId) {
      // Use the lower eventId for two-man fights to ensure consistent ID
      const lowerEventId = Math.min(fight.eventId, fight.opponent.eventId);
      return `${fight.gameId}-${lowerEventId}`;
    }
    return `${fight.gameId}-${fight.eventId}`;
  }
}

export default new FightDetector();
