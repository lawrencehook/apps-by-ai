#!/usr/bin/env bash
# Runs every repo check in order and stops at the first failure.
set -e
cd "$(dirname "$0")"

if [ ! -d tools/smoketest/node_modules ]; then
    echo "check.sh: tools/smoketest/node_modules is missing. Run: (cd tools/smoketest && npm install)" >&2
    exit 1
fi
export NODE_PATH="$PWD/tools/smoketest/node_modules"

step() {
    local name="$1"; shift
    echo
    echo "== $name"
    if ! "$@"; then
        echo >&2
        echo "check.sh: FAILED at step: $name" >&2
        exit 1
    fi
}

notes_build_clean() {
    python3 notes/build.py || return 1
    git diff --quiet -- notes math || { echo "notes/ or math/ differ from git after running notes/build.py (commit the rebuilt output):" >&2; git diff --stat -- notes math >&2; return 1; }
    local untracked
    untracked="$(git ls-files --others --exclude-standard -- notes math)" || return 1
    if [ -n "$untracked" ]; then
        echo "notes/build.py left untracked files:" >&2
        echo "$untracked" >&2
        return 1
    fi
}

step "syntax check" node check-syntax.js
step "smoke test" node tools/smoketest/run.js
step "smoke test regression" node tools/smoketest/regression-test.js
step "game tests" node --test games/lantern-labyrinth/tests/*.test.js
step "notes tests" node --test notes/tests/*.test.js
step "notes build leaves git clean" notes_build_clean

echo
echo "check.sh: all checks passed"
