/**
 * Backfill historical fight data from current season
 * Run this once to populate storage with existing fights
 */
import nhlApi from './src/nhlApi.js';
import fightDetector from './src/fightDetector.js';
import storage from './src/storage-enhanced.js';

async function backfillHistory() {
  console.log('🏒 Backfilling NHL Fight History\n');
  console.log('This will scan all games from the current season and add fights to storage.\n');
  console.log('─'.repeat(60));

  await storage.initialize();

  // Temporarily set wait period to 0 for backfill (no need to wait for historical fights)
  const originalWaitPeriod = fightDetector.waitPeriod;
  fightDetector.waitPeriod = 0;

  const today = new Date();
  const seasonStart = new Date('2025-10-07'); // Start of 2025-2026 season (Oct 7, 2025)
  const daysToScan = Math.floor((today - seasonStart) / (1000 * 60 * 60 * 24));

  console.log(`\nScanning ${daysToScan} days (from ${seasonStart.toDateString()} to ${today.toDateString()})`);
  console.log('This may take a few minutes...\n');

  let totalGames = 0;
  let totalFights = 0;
  let newFights = 0;

  // Scan each day
  for (let i = 0; i <= daysToScan; i++) {
    const date = new Date(seasonStart);
    date.setDate(date.getDate() + i);
    const dateString = date.toISOString().split('T')[0];

    try {
      // Get games for this date
      const response = await fetch(`https://api-web.nhle.com/v1/score/${dateString}`);
      const scoreData = await response.json();

      if (!scoreData.games || scoreData.games.length === 0) {
        continue;
      }

      totalGames += scoreData.games.length;

      // Check each completed game
      for (const game of scoreData.games) {
        if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') {
          continue;
        }

        try {
          // Small delay to be nice to API
          await new Promise(resolve => setTimeout(resolve, 200));

          const playByPlay = await nhlApi.getPlayByPlay(game.id);
          const fights = fightDetector.detectFights(playByPlay, storage);

          if (fights.length > 0) {
            console.log(`📅 ${dateString} | ${game.awayTeam.abbrev} @ ${game.homeTeam.abbrev}: ${fights.length} fight(s)`);

            for (const fight of fights) {
              const fightId = fightDetector.createFightId(fight);

              if (!storage.hasProcessed(fightId)) {
                // Get current season
                const season = getCurrentSeason();

                // Mark as processed with enhanced data for stats tracking
                await storage.markProcessed(fightId, {
                  season: season,
                  player: fight.player,
                  opponent: fight.opponent,
                  homeTeam: fight.homeTeam,
                  awayTeam: fight.awayTeam,
                  date: dateString  // Pass the actual game date
                });

                newFights++;
              }
              totalFights++;
            }
          }

        } catch (error) {
          if (!error.message.includes('404')) {
            console.error(`   ⚠️  Error checking game ${game.id}: ${error.message}`);
          }
        }
      }

    } catch (error) {
      console.error(`   ❌ Error fetching games for ${dateString}: ${error.message}`);
    }

    // Progress update every 7 days
    if (i % 7 === 0 && i > 0) {
      console.log(`\n   Progress: ${i}/${daysToScan} days scanned...`);
      console.log(`   Games: ${totalGames} | Fights found: ${totalFights} | New: ${newFights}\n`);
    }
  }

  // Restore original wait period
  fightDetector.waitPeriod = originalWaitPeriod;

  console.log('\n' + '─'.repeat(60));
  console.log('\n✅ Backfill Complete!\n');
  console.log(`   Total games scanned: ${totalGames}`);
  console.log(`   Total fights found: ${totalFights}`);
  console.log(`   New fights added: ${newFights}`);
  console.log(`   Already in storage: ${totalFights - newFights}\n`);
}

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 10) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Run backfill
backfillHistory().catch(console.error);
