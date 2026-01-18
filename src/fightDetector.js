/**
 * Detects fights from NHL play-by-play data
 */
class FightDetector {
  constructor() {
    // Queue to hold detected individual fighting penalties
    // Structure: Map<fightKey, {penalty, firstSeenAt, playByPlayData}>
    this.pendingFights = new Map();

    // How long to wait before processing a fight (in milliseconds)
    // This gives the NHL API time to populate both fighters
    this.waitPeriod = 120000; // 2 minutes

    // Time window for pairing fighters (in game seconds)
    this.pairingWindow = 15; // 15 seconds of game time
  }

  /**
   * Extract all fights from play-by-play data
   * This now returns pending fights that are ready to be processed
   * @param {Object} playByPlayData - Play-by-play data from NHL API
   * @param {Object} storage - Storage instance to check if already processed
   * @returns {Array} Array of fight objects that are ready to tweet
   */
  detectFights(playByPlayData, storage = null) {
    if (!playByPlayData.plays) {
      return [];
    }

    const now = Date.now();
    const penalties = playByPlayData.plays.filter(play => play.typeDescKey === 'penalty');

    // First, add any new fighting penalties to the queue
    penalties.forEach(play => {
      // Check if it's a fighting penalty
      const isFight = this.isFightingPenalty(play);

      if (isFight) {
        const fightInfo = this.extractFightInfo(play, playByPlayData);
        const key = `${fightInfo.gameId}-${fightInfo.eventId}`;

        // Check if already in queue
        if (this.pendingFights.has(key)) {
          return; // Already queued
        }

        // Check if already processed in storage
        if (storage) {
          const tempFight = { ...fightInfo, isTwoManFight: false };
          const fightId = this.createFightId(tempFight);
          if (storage.hasProcessed(fightId)) {
            return; // Already processed, don't re-queue
          }
        }

        // Add to queue
        console.log(`      ⏳ Adding fight to queue: ${fightInfo.player.name} (${fightInfo.player.team}) - Event ${fightInfo.eventId}`);
        console.log(`         Will wait ${this.waitPeriod / 1000}s before processing`);
        this.pendingFights.set(key, {
          penalty: fightInfo,
          firstSeenAt: now,
          playByPlayData: playByPlayData
        });
      }
    });

    // Also detect roughing penalties that have matching misconducts (alternate fight classification)
    const roughingFights = this.detectRoughingFights(penalties, playByPlayData);
    roughingFights.forEach(fightInfo => {
      const key = `${fightInfo.gameId}-${fightInfo.eventId}`;

      // Check if already in queue
      if (this.pendingFights.has(key)) {
        return; // Already queued
      }

      // Check if already processed in storage
      if (storage) {
        const tempFight = { ...fightInfo, isTwoManFight: false };
        const fightId = this.createFightId(tempFight);
        if (storage.hasProcessed(fightId)) {
          return; // Already processed, don't re-queue
        }
      }

      console.log(`      ⏳ Adding roughing fight to queue: ${fightInfo.player.name} (${fightInfo.player.team}) - Event ${fightInfo.eventId}`);
      console.log(`         Will wait ${this.waitPeriod / 1000}s before processing`);
      this.pendingFights.set(key, {
        penalty: fightInfo,
        firstSeenAt: now,
        playByPlayData: playByPlayData
      });
    });

    // Now check which fights are ready to be processed (past the wait period)
    const readyFights = [];
    const maxWaitTime = this.waitPeriod * 3; // Maximum 6 minutes to find a pair

    for (const [key, data] of this.pendingFights.entries()) {
      const timeSinceFirstSeen = now - data.firstSeenAt;

      if (timeSinceFirstSeen >= maxWaitTime) {
        // Been waiting too long without finding a pair - give up and remove
        console.log(`      ⏰ Timeout: ${data.penalty.player.name} waited ${(timeSinceFirstSeen / 1000).toFixed(1)}s without finding opponent - removing`);
        this.pendingFights.delete(key);
      } else if (timeSinceFirstSeen >= this.waitPeriod) {
        // This fight has been waiting long enough, try to process it
        readyFights.push({ key, data: data.penalty, waitTime: timeSinceFirstSeen });
      }
    }

    // Group fights by pairing them up (includes checking remaining queue for potential pairs)
    // This will return only paired fights and remove them from the queue
    return this.groupFights(readyFights, this.pendingFights, now);
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

    // Extract score from situationCode (format: AAHH where A=away score, H=home score, last 2=manpower)
    // Example: "1051" = away:1, home:0, 5v5 OR "2154" = away:2, home:1, 5v4
    let homeScore = 0;
    let awayScore = 0;
    if (play.situationCode) {
      const situationCode = play.situationCode.toString();
      if (situationCode.length >= 2) {
        awayScore = parseInt(situationCode.charAt(0), 10) || 0;
        homeScore = parseInt(situationCode.charAt(1), 10) || 0;
      }
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
      homeScore: homeScore,
      awayScore: awayScore
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
   * ONLY returns paired fights - singles are left in queue to retry
   * @param {Array} readyFights - Array of {key, data, waitTime} objects for fights ready to process
   * @param {Map} pendingQueue - The pending fights queue (to check for potential pairs still waiting)
   * @param {number} currentTime - Current timestamp
   * @returns {Array} Array of paired fight objects (only two-man fights)
   */
  groupFights(readyFights, pendingQueue = null, currentTime = Date.now()) {
    const grouped = [];
    const processed = new Set();
    const keysToRemove = []; // Keys to remove from pending queue

    readyFights.forEach((readyFight, index) => {
      if (processed.has(index)) return;

      const fight = readyFight.data;
      const fightKey = readyFight.key;

      // Look for matching fight at same time (within pairingWindow seconds and same period)
      const fightTime = this.timeToSeconds(fight.timeInPeriod);

      // First, try to find a match in other ready fights
      let matchingFight = null;
      let matchingIndex = -1;

      for (let i = 0; i < readyFights.length; i++) {
        if (i === index || processed.has(i)) continue;

        const other = readyFights[i].data;
        if (other.period !== fight.period) continue;
        if (other.gameId !== fight.gameId) continue;
        if (other.player.id === fight.player.id) continue;
        // Fighters must be on different teams
        if (other.player.team === fight.player.team) continue;

        const otherTime = this.timeToSeconds(other.timeInPeriod);
        const timeDiff = Math.abs(fightTime - otherTime);

        if (timeDiff <= this.pairingWindow) {
          matchingFight = other;
          matchingIndex = i;
          break;
        }
      }

      let matchingKey = null;

      // If no match in ready fights, check the pending queue for a potential pair
      if (!matchingFight && pendingQueue) {
        for (const [key, data] of pendingQueue.entries()) {
          // Skip if it's the current fight's key
          if (key === fightKey) continue;

          const pendingFight = data.penalty;

          // Check if this pending fight should be paired with the ready fight
          if (pendingFight.period !== fight.period) continue;
          if (pendingFight.gameId !== fight.gameId) continue;
          if (pendingFight.player.id === fight.player.id) continue;
          // Fighters must be on different teams
          if (pendingFight.player.team === fight.player.team) continue;

          const pendingTime = this.timeToSeconds(pendingFight.timeInPeriod);
          const timeDiff = Math.abs(fightTime - pendingTime);

          if (timeDiff <= this.pairingWindow) {
            // Found a match in pending queue! Process them together
            matchingFight = pendingFight;
            matchingKey = key;
            console.log(`      🔗 Pairing ready fight with pending: ${fight.player.name} + ${pendingFight.player.name}`);
            break;
          }
        }
      }

      if (matchingFight) {
        // Found a matching fight - pair them and remove both from queue
        processed.add(index);
        if (matchingIndex >= 0) {
          processed.add(matchingIndex);
          keysToRemove.push(readyFights[matchingIndex].key);
        }
        if (matchingKey) {
          keysToRemove.push(matchingKey);
        }
        keysToRemove.push(fightKey);

        console.log(`      ✅ Fight paired: ${fight.player.name} vs ${matchingFight.player.name}`);

        grouped.push({
          ...fight,
          opponent: {
            ...matchingFight.player,
            eventId: matchingFight.eventId  // Include eventId for duplicate detection
          },
          isTwoManFight: true
        });
      } else {
        // No matching opponent found yet - keep in queue to retry next cycle
        processed.add(index);
        console.log(`      ⏳ No opponent yet for ${fight.player.name} (waited ${(readyFight.waitTime / 1000).toFixed(1)}s) - keeping in queue`);
        // DON'T remove from queue - it will retry next cycle
      }
    });

    // Remove successfully paired fights from the pending queue
    keysToRemove.forEach(key => pendingQueue.delete(key));

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

  /**
   * Get current queue status for debugging
   * @returns {Object} Queue status information
   */
  getQueueStatus() {
    const now = Date.now();
    const queuedFights = [];

    for (const [key, data] of this.pendingFights.entries()) {
      const timeSinceFirstSeen = now - data.firstSeenAt;
      const timeRemaining = Math.max(0, this.waitPeriod - timeSinceFirstSeen);

      queuedFights.push({
        key,
        player: data.penalty.player.name,
        team: data.penalty.player.team,
        eventId: data.penalty.eventId,
        gameId: data.penalty.gameId,
        waitedSeconds: (timeSinceFirstSeen / 1000).toFixed(1),
        remainingSeconds: (timeRemaining / 1000).toFixed(1)
      });
    }

    return {
      count: this.pendingFights.size,
      fights: queuedFights
    };
  }
}

export default new FightDetector();
