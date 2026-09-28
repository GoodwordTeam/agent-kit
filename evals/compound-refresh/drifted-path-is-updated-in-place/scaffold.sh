#!/usr/bin/env bash
# Scaffold for evals/compound-refresh/drifted-path-is-updated-in-place.
#
# tiny-service-repo with the rate limiter where it used to live: the
# baseline has it at src/gateway/rate-limit.js (tested from test/gateway/),
# and a commit dated 2026-09-18 moves it to src/middleware/, where the
# fixture keeps it. Behaviour is unchanged by the move.
#
# The knowledgebase adapter has no implementation in the workspace, so the
# project's knowledgebase is supplied as a read-only checkout under
# knowledge-base/, untracked and outside the application's history. It holds
# three lessons about rate limiting and one about sessions:
#   - a gotcha whose statement still holds and whose path is the old one;
#   - a pattern that is accurate as written;
#   - a gotcha about the CDN in front of the service, which nothing in the
#     workspace can confirm or refute;
#   - a session gotcha, outside the scope asked for.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../super-build/_fixtures/scaffold-lib.sh
source "$SCRIPT_DIR/../../super-build/_fixtures/scaffold-lib.sh"

fixture_copy tiny-service-repo
mkdir -p test/gateway
mv src/middleware/rate-limit.js src/gateway/rate-limit.js
mv test/middleware/rate-limit.test.js test/gateway/rate-limit.test.js
rmdir src/middleware test/middleware
sed -i.bak "s#require('../middleware/rate-limit')#require('./rate-limit')#" src/gateway/router.js
sed -i.bak "s#require('../../src/middleware/rate-limit')#require('../../src/gateway/rate-limit')#" test/gateway/rate-limit.test.js
rm src/gateway/router.js.bak test/gateway/rate-limit.test.js.bak
repo_init
commit_all "baseline: tiny-service"

mkdir -p src/middleware test/middleware
git mv -k src/gateway/rate-limit.js src/middleware/rate-limit.js
git mv -k test/gateway/rate-limit.test.js test/middleware/rate-limit.test.js
sed -i.bak "s#require('./rate-limit')#require('../middleware/rate-limit')#" src/gateway/router.js
sed -i.bak "s#require('../../src/gateway/rate-limit')#require('../../src/middleware/rate-limit')#" test/middleware/rate-limit.test.js
rm src/gateway/router.js.bak test/middleware/rate-limit.test.js.bak
commit_all "move the rate limiter into the shared middleware package" "2026-09-18T15:20:00+00:00"
cmp -s src/middleware/rate-limit.js "$FIXTURES_DIR/tiny-service-repo/src/middleware/rate-limit.js" \
  || scaffold_die "the moved limiter differs from the fixture"

kb=knowledge-base
mkdir -p "$kb/gotcha" "$kb/pattern"
cat > "$kb/README.md" <<'MD'
# tiny-service knowledgebase

Read-only checkout of the central knowledgebase's pages for the
tiny-service project, taken 2026-09-25. It is not part of the application
repository and nothing here is committed with it. Changes to these pages go
back to the knowledgebase as candidate changes; they are not edited here.

Pages are grouped by kind. Each carries its id, kind, scope and status in
its frontmatter.
MD
cat > "$kb/gotcha/rate-limit-keys-on-client-ip.md" <<'MD'
---
id: kb-gotcha-0031
kind: gotcha
scope: tiny-service/gateway
status: active
created: 2026-06-02
---

# The rate limiter counts per client IP, not per account

`rateLimit` in `src/gateway/rate-limit.js` keys its window on `req.ip`.
Two accounts behind one office NAT share a single budget, and one account
spread across several addresses gets several. When a customer reports
unexpected 429s, check how many users share their egress address before
raising their limit.
MD
cat > "$kb/pattern/rate-limits-come-from-config.md" <<'MD'
---
id: kb-pattern-0012
kind: pattern
scope: tiny-service/config
status: active
created: 2026-05-20
---

# Rate limits come from config, never from the call site

The window and the ceiling are read from `rateLimit` in the loaded config:
defaults in `src/config/defaults.js`, overridden per environment in
`config/<env>.json` (production raises `max`). `createRouter` takes them as
`limits` and hands them to the limiter unchanged. Tune a limit by changing
config, not by passing numbers where the limiter is built.
MD
cat > "$kb/gotcha/cdn-rate-limits-before-us.md" <<'MD'
---
id: kb-gotcha-0044
kind: gotcha
scope: tiny-service/edge
status: active
created: 2026-07-11
---

# The CDN rejects bursts before our limiter sees them

The CDN in front of the service drops a client above 1,000 requests a
minute with its own 429, which carries no `Retry-After`. A 429 without that
header did not come from us, and raising our limit will not help.
MD
cat > "$kb/gotcha/session-refresh-needs-the-lock.md" <<'MD'
---
id: kb-gotcha-0027
kind: gotcha
scope: tiny-service/session
status: active
created: 2026-05-08
---

# Refresh a session only inside its lock

`SessionStore.refresh` reads the record inside `withLock`. Reading it before
taking the lock lets two concurrent refreshes both start from the same
version, and one of the two increments is lost.
MD

echo "scaffold: tiny-service ready at $(git rev-parse --short HEAD)"
