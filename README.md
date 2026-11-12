# MTC app

Mental game app for tennis players. Roadmap, player identity, daily journal, weekly reflection, classroom, community, accounts.

## Two versions

- **Live** (what players use): the files in the top folder. https://schroederbendix.github.io/mtc-app/
- **Beta** (the next version, for testing): the `beta/` folder. https://schroederbendix.github.io/mtc-app/beta/

Beta has its own test database, so nothing you try there touches real players. Both versions keep players' data in Supabase, so when beta goes live nobody loses anything.

## Work on the next version

Change files in `beta/` only. When you change a file there, also change `VERSION` in `beta/sw.js` (`mtc-beta-2`, `mtc-beta-3`, ...) so phones pick up the update.

Lesson text, journal questions and community info live in `beta/content.js`.

## Release

Set the new version number in `beta/version.js` (2.0, 2.1, 3.0, ...) before releasing. Shown on the Account page.

1. Database changes: the files in `supabase/migrations/` are applied to the test database first, then to the live one before the release.
2. Run `tools/release.sh`. It copies beta to the top folder, keeps the live database settings, and bumps the cache version.
3. Commit and push, then tag the release (`git tag v2.1 && git push origin v2.1`). The live app updates in about a minute, and players see it the next time they open the app. To roll back, restore the files from the previous tag.

## Files

- `content.js` lessons, routines, journal questions, identity example, community
- `app.js` the app
- `app.css` the MTC design
- `config.js` which database this version talks to (differs between beta and live)
- `vendor/supabase.js` the Supabase library, stored here so nothing loads from outside
- `sw.js`, `manifest.webmanifest` make it installable and work offline
- `supabase/migrations/` the database setup
- `tools/` release script and tests (`tools/test`, run with Python and Playwright)

## Who can see what

Players see only their own data. Bendix (admin) sees name, level, phone, how often they write, and nothing else, unless a player chooses to share their journal. 1:1 clients always share. This is enforced in the database (row level security), not just in the app.
