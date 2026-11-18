#!/bin/bash

# Continuous AI App Brainstorm & Implement Loop
# This script alternates between brainstorming new app ideas and implementing them
# Press Ctrl+C to stop, or set MAX_ITERATIONS=N to stop after N rounds

set -e

# Defaults to the directory containing this script; override with REPO_DIR=... if needed
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
LOG_FILE="$REPO_DIR/auto-brainstorm.log"
ITERATION=0
MAX_ITERATIONS="${MAX_ITERATIONS:-0}"   # 0 = no limit
FAILURES=0

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

if ! command -v claude >/dev/null 2>&1; then
    echo "claude CLI not found on PATH" >&2
    exit 1
fi

# Prints the failing gate's output and returns non-zero if either gate fails
run_checks() {
    node "$REPO_DIR/check-syntax.js" || return 1
    # Runtime check is only available once its jsdom dependency is installed
    if [ -d "$REPO_DIR/tools/smoketest/node_modules" ]; then
        node "$REPO_DIR/tools/smoketest/run.js" || return 1
    fi
}

log "${GREEN}Starting continuous brainstorm & implement loop${NC}"
log "Working directory: $REPO_DIR"
log "Press Ctrl+C to stop"
echo ""

while [ "$MAX_ITERATIONS" -eq 0 ] || [ "$ITERATION" -lt "$MAX_ITERATIONS" ]; do
    ITERATION=$((ITERATION + 1))
    log "${BLUE}========== ITERATION $ITERATION ==========${NC}"

    # Phase 1: Brainstorm
    log "${GREEN}Phase 1: Brainstorming new app ideas...${NC}"

    APP_COUNT=$(find "$REPO_DIR/apps" -mindepth 1 -maxdepth 1 -type d | wc -l)
    BRAINSTORM_PROMPT="You are working on an AI showcase repository with ~$APP_COUNT small web apps/tools.

Current apps include: utilities (calculators, converters, generators), visualizations (fractals, simulations, algorithms), and tools (PDF, image, audio manipulation).

TASK: Brainstorm 5 NEW app ideas that DO NOT already exist in the ./apps folder. Prioritize by:
1. Utility - apps that solve real problems people have
2. Visual impact - apps that look impressive and demonstrate capability

For each idea, provide:
- App name (kebab-case, e.g., 'particle-system')
- One-line description
- Why it ranks high on visual impact and/or utility

First, check the existing ./apps folder to avoid duplicates. Then output your 5 ideas ranked by combined visual impact + utility score.

Output format:
### TOP 5 NEW APP IDEAS
1. **app-name**: Description - [Utility: X/10, Visual: Y/10]
2. ...

Be creative but realistic - these should be implementable as single-page web apps."

    claude -p "$BRAINSTORM_PROMPT" \
        --allowedTools "Bash,Glob,Grep,Read" \
        --output-format text \
        2>&1 | tee -a "$LOG_FILE"

    BRAINSTORM_EXIT=${PIPESTATUS[0]}

    if [ $BRAINSTORM_EXIT -ne 0 ]; then
        FAILURES=$((FAILURES + 1))
        if [ $FAILURES -ge 5 ]; then
            log "${YELLOW}Brainstorm failed $FAILURES times in a row; giving up.${NC}"
            exit 1
        fi
        log "${YELLOW}Brainstorm phase encountered an issue. Waiting 30s before retry...${NC}"
        sleep 30
        continue
    fi
    FAILURES=0

    echo ""
    log "${GREEN}Phase 2: Implementing top 3 brainstormed apps...${NC}"

    # Phase 2: Implement (using --continue to maintain context from brainstorm)
    IMPLEMENT_PROMPT="Now implement the TOP 3 apps from the ideas you just brainstormed.

For each app:
1. Create a new folder in ./apps/ with the app name
2. Create index.html with a complete, working single-page implementation
3. Use vanilla HTML/CSS/JavaScript. Never load code from a CDN or any URL: if a library is genuinely needed, vendor it into libs/<name>-<version>/ (see libs/README.md) and reference it as ../../libs/...
4. Make it visually polished with good UX
5. After creating each app, update metadata.json to add the new app entry (include a completeness rating 1-5)

Read DEVELOPMENT_GUIDELINES.md first and follow every rule in it (escape user input before innerHTML, use Pointer Events so touch works, guard browser APIs, etc.).

Follow the patterns established by existing apps in the repo. Each app should be self-contained and immediately functional.

Implement all 3 apps now, one at a time. After each app, run 'node check-syntax.js <app-name>' and fix any errors before moving on."

    claude -p "$IMPLEMENT_PROMPT" \
        --continue \
        --allowedTools "Bash,Glob,Grep,Read,Edit,Write" \
        --output-format text \
        2>&1 | tee -a "$LOG_FILE"

    IMPLEMENT_EXIT=${PIPESTATUS[0]}

    if [ $IMPLEMENT_EXIT -ne 0 ]; then
        log "${YELLOW}Implementation phase encountered an issue.${NC}"
    fi

    # Phase 3: Gate on the checks. An app that doesn't parse or load is dead on
    # arrival, and a read-only self-review won't catch it.
    log "${GREEN}Phase 3: Checking all apps...${NC}"
    if ! CHECK_OUTPUT=$(run_checks 2>&1); then
        log "${YELLOW}Checks failed; asking for a fix pass.${NC}"
        echo "$CHECK_OUTPUT" | tee -a "$LOG_FILE"
        claude -p "The repo checks failed with the output below. Fix every error, then re-run 'node check-syntax.js' and 'node tools/smoketest/run.js' until both pass.

$CHECK_OUTPUT" \
            --continue \
            --allowedTools "Bash,Glob,Grep,Read,Edit,Write" \
            --output-format text \
            2>&1 | tee -a "$LOG_FILE"
        if ! CHECK_OUTPUT=$(run_checks 2>&1); then
            log "${YELLOW}Checks still failing after the fix pass; stopping so broken apps don't pile up.${NC}"
            echo "$CHECK_OUTPUT" | tee -a "$LOG_FILE"
            exit 1
        fi
        log "Checks pass after the fix pass."
    else
        log "Checks passed."
    fi

    echo ""
    log "${GREEN}Iteration $ITERATION complete!${NC}"
    log "Waiting 10 seconds before next iteration..."
    echo ""

    sleep 10
done
