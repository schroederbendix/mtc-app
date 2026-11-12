#!/usr/bin/env bash
# Publish the beta (test version) as the live version.
# Run from anywhere. Afterwards commit and push; GitHub Pages updates the live app in about a minute.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in index.html app.css app.js content.js version.js sw.js manifest.webmanifest bendix.jpg; do cp "beta/$f" "$f"; done
rm -rf brand icons vendor
cp -r beta/brand beta/icons beta/vendor .
cp tools/config.live.js config.js

STAMP="mtc-$(date -u +%Y%m%d%H%M)"
sed -i "s/^const VERSION = .*/const VERSION = '$STAMP';/" sw.js
sed -i 's/"name": "MTC Beta"/"name": "MTC: Mental Tennis Coaching"/; s/"short_name": "MTC Beta"/"short_name": "MTC"/' manifest.webmanifest
sed -i 's#"id": "/mtc-app/beta/"#"id": "/mtc-app/"#' manifest.webmanifest
sed -i 's#<title>MTC Beta:#<title>MTC:#' index.html

VER=$(sed -n "s/.*MTC_VERSION = '\(.*\)';/\1/p" version.js)
echo "Live files updated from beta: version $VER (cache version $STAMP)."
echo "After committing, tag it:  git tag v$VER && git push origin v$VER"
echo "Reminder: the database changes in supabase/migrations must already be applied to the live project."
