#!/bin/bash

# Check if fights.json exists
if [ ! -f "fights.json" ]; then
  echo "No fight data found. Running backfill..."
  node backfill-history.js
fi

# Start the bot
node src/index.js
