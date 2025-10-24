# NHL Fights Twitter Bot

A Twitter bot that automatically monitors NHL games and tweets whenever a fight occurs.

## Features

- Real-time monitoring of NHL games using the official NHL API
- Automatic detection of fighting penalties from play-by-play data
- Tweets fight details including players involved, teams, game info, and time
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
2. **Fight Detection**: For each active game, it fetches play-by-play data and looks for fighting penalties
3. **Tweet Generation**: When a fight is detected, it formats a tweet with:
   - Players involved
   - Teams
   - Game situation
   - Period and time
   - Score
4. **Duplicate Prevention**: Fights are stored locally to prevent duplicate tweets

## API Information

This bot uses the unofficial NHL API:
- Base URL: `https://api-web.nhle.com/`
- No API key required for NHL data
- Endpoints used:
  - `/v1/score/now` - Current games
  - `/v1/gamecenter/{gameId}/play-by-play` - Play-by-play data

## Example Tweet Format

```
🥊 FIGHT! 🥊

Milan Lucic (BOS) vs Ryan Reaves (TOR)

Q2 14:32 | BOS 2-1 TOR

#NHLFights #Bruins #MapleLeafs
```

## License

MIT
