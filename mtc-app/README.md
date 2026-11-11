# MTC app

Mental game app for tennis players. Roadmap, player identity, daily journal, weekly reflection, classroom, community.

## Put it online (GitHub Pages, free)

1. On github.com click New repository. Name it `mtc-app`, set it to Public, create it.
2. Click "uploading an existing file", drag in everything from this folder (all files and the `brand` and `icons` folders), and commit.
3. Go to Settings, then Pages. Under "Build and deployment" choose "Deploy from a branch", branch `main`, folder `/ (root)`, and save.
4. After about a minute the app is live at `https://YOUR-USERNAME.github.io/mtc-app/`.

## Edit your content

Open `content.js` on GitHub, click the pencil, change the text, and commit. Live in about a minute.

When you change any file, also change `VERSION = 'mtc-v1'` in `sw.js` to the next number (`mtc-v2`), so phones pick up the update.

## Files

- `content.js` lessons, routines, journal questions, identity example, community
- `app.js` the app itself
- `app.css` the MTC design
- `sw.js` and `manifest.webmanifest` make it installable and work offline

Everything players write is saved on their own phone for now. Accounts come next.
