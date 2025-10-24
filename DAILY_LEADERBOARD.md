# Daily Leaderboard Feature

The bot can automatically post a daily leaderboard tweet at a scheduled time every day.

## Configuration

Add these settings to your `.env` file:

```env
# Daily Leaderboard (posts at same time every day)
DAILY_LEADERBOARD_ENABLED=true
DAILY_LEADERBOARD_TIME=12:00  # 24-hour format (HH:MM)
TIMEZONE=America/Chicago
```

### Settings Explained

- **DAILY_LEADERBOARD_ENABLED**: Set to `true` to enable, `false` to disable
- **DAILY_LEADERBOARD_TIME**: Time to post in 24-hour format (HH:MM)
  - Examples: `12:00` (noon), `09:00` (9am), `18:30` (6:30pm)
- **TIMEZONE**: Uses the same timezone as your active hours
  - Examples: `America/Chicago`, `America/New_York`, `America/Los_Angeles`
  - Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

## What Gets Posted

The daily leaderboard includes:

1. **Top 5 Fighters** - Players with the most fights this season
2. **Top 3 Team Rivalries** - Team matchups with the most fights
3. **This Week's Count** - Total fights in the current week

### Example Tweet

```
📊 NHL FIGHTS LEADERBOARD

🥊 TOP FIGHTERS:
1. Ross Johnston (ANA) 3
2. Jeff Malott (LAK) 3
3. Ryan Reaves (SJS) 2
4. Michael McCarron (NSH) 2
5. Ryan Lomberg (CGY) 2

🔥 TOP RIVALRIES:
1. ANA-vs-NSH 3
2. OTT-vs-TBL 2
3. COL-vs-DAL 2

📅 Week: 32

#NHLFights #NHL
```

## Testing

### Preview the Tweet

See what the leaderboard will look like without posting:

```bash
node test-leaderboard-tweet.js
```

### Post Immediately

Manually post a leaderboard tweet right now:

```bash
node post-leaderboard-now.js
```

This is useful for:
- Testing before enabling scheduled posts
- Posting a one-off leaderboard
- Verifying your Twitter credentials work

## How It Works

The bot uses `node-cron` to schedule tweets:

1. When the bot starts, it sets up a cron job based on your `DAILY_LEADERBOARD_TIME`
2. Every day at that time, the bot:
   - Gathers statistics from storage
   - Formats the leaderboard tweet
   - Posts to Twitter
3. The schedule runs in the background alongside fight monitoring

## Scheduling Examples

| Time | Setting | Description |
|------|---------|-------------|
| Noon | `12:00` | Post at 12pm every day |
| Morning | `09:00` | Post at 9am every day |
| Evening | `18:30` | Post at 6:30pm every day |
| Midnight | `00:00` | Post at midnight every day |

## Disabling

To disable daily leaderboards, set in `.env`:

```env
DAILY_LEADERBOARD_ENABLED=false
```

The bot will still track all statistics but won't post them automatically.
