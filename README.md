# NHL Fights Twitter Bot

A Twitter bot that automatically monitors NHL games and tweets whenever a fight occurs.
(https://x.com/nhl_fight_bot)
@nhl_fight_bot

## Features

- Real-time monitoring of NHL games using the official NHL API
- Advanced fight detection algorithm that recognizes:
  - Traditional fighting penalties (5 minute majors)
  - Fights called as roughing + misconduct combinations
  - Smart pairing of fighters even with slight time differences (up to 5 seconds)
- Tweets fight details including both players involved, teams, game info, and time
- Prevention of "self-fights" (same player listed twice)
- Captain detection for special acknowledgment when team captains fight
- Duplicate prevention to avoid tweeting the same fight multiple times
- Configurable polling interval

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Twitter API Setup

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app (or use existing)
3. Generate API keys and access tokens with **Read and Write** permissions
4. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `.env` with your Twitter API credentials:

```
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_SECRET=your_access_secret_here
POLL_INTERVAL=60000
```

## Usage

### Start the Bot

```bash
npm start
```

### Development Mode (with auto-restart)

```bash
npm run dev
```

## How It Works

1. **Game Monitoring**: Every minute (configurable), the bot checks for ongoing NHL games
2. **Advanced Fight Detection**: For each active game, it fetches play-by-play data and:
   - Identifies traditional fighting penalties (5 minute majors)
   - Detects fights called as roughing + misconduct (when both penalties occur together)
   - Intelligently pairs fighters by matching penalties within 5 seconds of each other
   - Prevents incorrect self-pairing when a player receives multiple penalties
3. **Tweet Generation**: When a fight is detected, it formats a tweet with:
   - Both fighters' names (or single fighter if no opponent found)
   - Team abbreviations
   - Special captain acknowledgment if applicable
   - Period and time
   - Current score
   - Team-specific hashtags
4. **Duplicate Prevention**: Fights are tracked using unique identifiers to prevent duplicate tweets

## API Information

This bot uses the NHL's undocumented web API (the same API used by NHL.com and official NHL apps):
- Base URL: `https://api-web.nhle.com/`
- This is the actual NHL API but not publicly documented or officially supported for third-party use
- No API key required
- Endpoints used:
  - `/v1/schedule/{date}` - Games by date
  - `/v1/score/now` - Current games
  - `/v1/gamecenter/{gameId}/play-by-play` - Play-by-play data

## Example Tweet Format

```
🥊 FIGHT! 🥊

Milan Lucic (BOS) vs Ryan Reaves (TOR)

Q2 14:32 | BOS 2-1 TOR

#NHLFights #Bruins #MapleLeafs
```

## Recent Improvements

### Fight Detection Enhancements (October 2025)
- **Roughing + Misconduct Detection**: Now detects fights that refs call as roughing penalties with matching 10-minute misconducts (e.g., Bertuzzi vs Cousins fight)
- **Time Tolerance Matching**: Pairs fighters even when penalties are recorded up to 5 seconds apart
- **Self-Fight Prevention**: Added validation to prevent a player from being matched with themselves when receiving multiple penalties
- **Better Fight Grouping**: Improved algorithm ensures both players are shown in tweets when data is available

## License

MIT
