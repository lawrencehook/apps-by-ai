#!/bin/bash

# Continuous AI App Brainstorm & Implement Loop
# This script alternates between brainstorming new app ideas and implementing them
# Press Ctrl+C to stop

set -e

REPO_DIR="/mnt/c/Users/lawre/github/ai-showcase"
LOG_FILE="$REPO_DIR/auto-brainstorm.log"
ITERATION=0

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log "${YELLOW}Stopping auto-brainstorm loop...${NC}"
    log "Completed $ITERATION iterations"
    exit 0
}

trap cleanup SIGINT SIGTERM

cd "$REPO_DIR"

log "${GREEN}Starting continuous brainstorm & implement loop${NC}"
log "Working directory: $REPO_DIR"
log "Press Ctrl+C to stop"
echo ""

while true; do
    ITERATION=$((ITERATION + 1))
    log "${BLUE}========== ITERATION $ITERATION ==========${NC}"

    # Phase 1: Brainstorm
    log "${GREEN}Phase 1: Brainstorming new app ideas...${NC}"

    BRAINSTORM_PROMPT="You are working on an AI showcase repository with ~110 small web apps/tools.

Current apps include: utilities (calculators, converters, generators), visualizations (fractals, simulations, algorithms), and tools (PDF, image, audio manipulation).

TASK: Brainstorm 5 NEW app ideas that DO NOT already exist in the ./apps folder. Prioritize by:
1. Visual impact - apps that look impressive and demonstrate capability
2. Utility - apps that solve real problems people have

For each idea, provide:
- App name (kebab-case, e.g., 'particle-system')
- One-line description
- Why it ranks high on visual impact and/or utility

First, check the existing ./apps folder to avoid duplicates. Then output your 5 ideas ranked by combined visual impact + utility score.

Output format:
### TOP 5 NEW APP IDEAS
1. **app-name**: Description - [Visual: X/10, Utility: Y/10]
2. ...

Be creative but realistic - these should be implementable as single-page web apps."

    claude -p "$BRAINSTORM_PROMPT" \
        --allowedTools "Bash,Glob,Grep,Read" \
        --output-format text \
        2>&1 | tee -a "$LOG_FILE"

    BRAINSTORM_EXIT=${PIPESTATUS[0]}

    if [ $BRAINSTORM_EXIT -ne 0 ]; then
        log "${YELLOW}Brainstorm phase encountered an issue. Waiting 30s before retry...${NC}"
        sleep 30
        continue
    fi

    echo ""
    log "${GREEN}Phase 2: Implementing top 3 brainstormed apps...${NC}"

    # Phase 2: Implement (using --continue to maintain context from brainstorm)
    IMPLEMENT_PROMPT="Now implement the TOP 3 apps from the ideas you just brainstormed.

For each app:
1. Create a new folder in ./apps/ with the app name
2. Create index.html with a complete, working single-page implementation
3. Use vanilla HTML/CSS/JavaScript (no external dependencies except CDN libs if needed)
4. Make it visually polished with good UX
5. After creating each app, update metadata.json to add the new app entry

Follow the patterns established by existing apps in the repo. Each app should be self-contained and immediately functional.

Implement all 3 apps now, one at a time. After each app, verify it was created correctly."

    claude -p "$IMPLEMENT_PROMPT" \
        --continue \
        --allowedTools "Bash,Glob,Grep,Read,Edit,Write" \
        --output-format text \
        2>&1 | tee -a "$LOG_FILE"

    IMPLEMENT_EXIT=${PIPESTATUS[0]}

    if [ $IMPLEMENT_EXIT -ne 0 ]; then
        log "${YELLOW}Implementation phase encountered an issue.${NC}"
    fi

    echo ""
    log "${GREEN}Iteration $ITERATION complete!${NC}"
    log "Waiting 10 seconds before next iteration..."
    echo ""

    sleep 10
done
