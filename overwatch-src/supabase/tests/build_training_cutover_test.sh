#!/usr/bin/env bash
# Build the one-request rolled-back test: setup + both migration bodies (BEGIN/COMMIT stripped) + checks.
set -euo pipefail
cd "$(dirname "$0")/.."
body() { sed -e '/^BEGIN;$/d' -e '/^COMMIT;$/d' "$1"; }
python3 - "$@" <<'PY'
import subprocess
t = open("tests/training_cutover_rolledback_test.sql").read()
def body(p):
    return "\n".join(l for l in open(p).read().splitlines() if l.strip() not in ("BEGIN;", "COMMIT;"))
m = body("migrations/20261017202341_training_cutover.sql") + "\n" + body("migrations/20261017202346_remove_duplicate_empty_courses.sql").replace("ON COMMIT DROP", "")
print(t.replace("--@@MIGRATIONS@@", m))
PY
