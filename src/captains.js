/**
 * Captain management for special fight tweets
 * Hard-coded list of NHL team captains by player ID
 */
class CaptainsManager {
  constructor() {
    // Map of player ID -> team name
    this.captains = new Map([
      [8475462, 'Anaheim Ducks'], // Radko Gudas
      [8480839, 'Buffalo Sabres'], // Rasmus Dahlin
      [8474150, 'Calgary Flames'], // Mikael Backlund
      [8473533, 'Carolina Hurricanes'], // Jordan Staal
      [8473422, 'Chicago Blackhawks'], // Nick Foligno
      [8476455, 'Colorado Avalanche'], // Gabriel Landeskog
      [8476432, 'Columbus Blue Jackets'], // Boone Jenner
      [8473994, 'Dallas Stars'], // Jamie Benn
      [8477946, 'Detroit Red Wings'], // Dylan Larkin
      [8478402, 'Edmonton Oilers'], // Connor McDavid
      [8477493, 'Florida Panthers'], // Aleksander Barkov
      [8471685, 'Los Angeles Kings'], // Anze Kopitar
      [8474716, 'Minnesota Wild'], // Jared Spurgeon
      [8480018, 'Montreal Canadiens'], // Nick Suzuki
      [8474600, 'Nashville Predators'], // Roman Josi
      [8480002, 'New Jersey Devils'], // Nico Hischier
      [8475314, 'New York Islanders'], // Anders Lee
      [8476468, 'New York Rangers'], // J.T. Miller
      [8480801, 'Ottawa Senators'], // Brady Tkachuk
      [8476461, 'Philadelphia Flyers'], // Sean Couturier
      [8471675, 'Pittsburgh Penguins'], // Sidney Crosby
      [8474586, 'Seattle Kraken'], // Jordan Eberle
      [8475170, 'St. Louis Blues'], // Brayden Schenn
      [8475167, 'Tampa Bay Lightning'], // Victor Hedman
      [8479318, 'Toronto Maple Leafs'], // Auston Matthews
      [8479343, 'Utah Mammoth'], // Clayton Keller
      [8480800, 'Vancouver Canucks'], // Quinn Hughes
      [8475913, 'Vegas Golden Knights'], // Mark Stone
      [8471214, 'Washington Capitals'], // Alex Ovechkin
    ]);

    console.log(`✅ Loaded ${this.captains.size} team captains`);
  }

  /**
   * Check if a player is a captain
   * @param {number} playerId - NHL player ID
   * @returns {boolean} True if player is a captain
   */
  isCaptain(playerId) {
    return this.captains.has(playerId);
  }

  /**
   * Get the team name for a captain
   * @param {number} playerId - NHL player ID
   * @returns {string|null} Team name or null if not a captain
   */
  getCaptainTeam(playerId) {
    return this.captains.get(playerId) || null;
  }
}

export default new CaptainsManager();
