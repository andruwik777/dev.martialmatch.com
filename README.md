# MartialMatch viewer

A lightweight web front end for [martialmatch.com](https://martialmatch.com) data, focused on **filtering by multiple athletes** and **shareable links**. This helps the coach stay focused and keep track of the athletes he is interested in during a specific event, or simply lets you see which competitions your friends have registered for. Have fun! 🤼🥋🥊

**Live site (Stable):** [andruwik777.github.io/martialmatch.com](https://andruwik777.github.io/martialmatch.com)

[![Watch the video](https://i.sstatic.net/Vp2cE.png)](https://youtu.be/vt5fpE0bzSY)

[![Watch the video](https://github.com/andruwik777/dev.martialmatch.com/blob/master/demo.jpg)](https://www.youtube.com/shorts/vE49NYUGRHg)

<p align="center">
  <video src="./Screen_Recording_20260426_124402_Chrome.mp4" width="45%" style="display:inline-block; margin-right: 10px;"/>
</p>

## Disclaimer

This project is **not affiliated with** MartialMatch. Functionality depends on MartialMatch’s public HTML and API; changes on their side may break scraping or views.

**Compliance (proxy):** The official **[Regulamin / terms and conditions](https://martialmatch.com/pl/terms-and-conditions)** do not forbid using a **proxy server** to reach the site, and do not spell out a separate **software or API license** that would prohibit a third-party, read-only viewer built on the same public URLs your browser would load. This app is meant as a convenience layer (filtering, shareable links) over that public surface—not to bypass paywalls, authentication, or stated restrictions. *MartialMatch can change their terms at any time; re-read the Regulamin if in doubt. This is the maintainer’s reading, not legal advice.*

## Why this exists

The official MartialMatch site does not provide functionality to filter **live fights** and **schedule** by a **set of people at once**. For a **coach at a competition** with a group of kids (or anyone following several athletes), that is awkward: you keep searching manually for who fights when.

This app lets you **pick athletes in a filter** and see only the **fights** and **harmonogram** that matter for **one selected competition** (the active event in the URL via `slug`).

Separately, with **“all competitions”** mode enabled in the UI, you can scan **every competition in the list** and see **which events those athletes are registered for**. That is a **different workflow** from the per-competition filter: the two modes **do not mix** on screen, but they share the same idea—**stay on top of your people**.

Filters are stored in the **URL**, so you can **share a link** with friends or parents and they open the **same filtered view** without redoing the setup.

## Feedback & feature requests

- **Report bugs or request a feature:** [GitHub Issues](https://github.com/andruwik777/dev.martialmatch.com/issues)

## Architecture: GitHub Pages → your proxies → martialmatch.com

The app is a **vanilla JavaScript** single-page site on **GitHub Pages**. It does **not** call `martialmatch.com` directly from the browser for app data. Instead it keeps **two parallel connections** to infrastructure you control, with **martialmatch.com** as the real upstream for both.

### Why a WebSocket, not only HTTP

Live **fights** and the **scoreboard** (timer, status, points) are updated in real time over **WebSocket** channels, the same way the official product does. REST alone is not enough for that live layer.

### Why two different proxies

1. **HTTP / JSON** — Browsers enforce **CORS**. A page on `*.github.io` cannot read the official API responses unless the server sends an allowlist for that origin. The public API is not set up for third-party web origins, so the app uses a **Cloudflare Worker** ([`BASE_BY_MODE`](config.js)) that forwards `/api/…` and adds the appropriate **CORS** headers.
2. **WebSocket** — The upstream `wss://` scoreboard is tied to **first-party / expected `Origin`** behavior. A GitHub Pages origin is rejected for that connection path. The app therefore opens **`wss://` to a small Node proxy** that you run yourself; the proxy opens the real upstream socket with an allowed origin and forwards channel messages to the browser. **Without this WebSocket proxy, live scoreboard data is not available in the public build.** Configure `WSS_BASE_BY_MODE` in [config.js](config.js); details in [server/README-wss.md](server/README-wss.md).

### Deployment (where the proxies run)

- **WebSocket** scoreboard proxy: deployed on **[Render](https://render.com/)** (see [server/README-wss.md](server/README-wss.md) and `WSS_BASE_BY_MODE` in [config.js](config.js)).
- **HTTP** API proxy: **Cloudflare Workers** (see `BASE_BY_MODE` in [config.js](config.js) and the [For developers](#for-developers) section).
- **Static UI:** this repo, **GitHub Pages**.

### High-level diagram (ASCII)

```
                         ┌─────────────────────────────────────┐
                         │  Browser (user)                     │
                         │  SPA: vanilla JS on GitHub Pages   │
                         │  • REST: schedules, fights, lists  │
                         │  • WSS: live scoreboard / timer    │
                         └────────────┬────────────┬──────────┘
                                      │            │
         HTTPS (CORS handled          │            │  WebSocket
         at your edge)                │            │  (Origin handled
                                      ▼            ▼  at your proxy)
   ┌──────────────────────┐   ┌──────────────────────────────┐
   │  HTTP proxy          │   │  WebSocket proxy (Node)       │
   │  Cloudflare Worker   │   │  e.g. Render (see server/)     │
   │  • allow browser     │   │  • accept client connection     │
   │  • forward /api      │   │  • open upstream wss to MM      │
   │    to martialmatch   │   │  • relay scoreboard channels    │
   └──────────┬───────────┘   └──────────────┬──────────────────┘
              │                              │
              │   HTTPS to official API        │   WSS to official
              ▼                              ▼   scoreboard
   ┌──────────────────────────────────────────────────────────┐
   │  martialmatch.com  (target: REST + real-time data)     │
   └──────────────────────────────────────────────────────────┘
```

The browser talks only to **your** Worker and **your** `wss://` host; both components then reach the real site on your behalf.

## For developers

Use "mode=test" in query URL parameters to simulate data with active competitions. 

Proxy server is implemented as Cloudflare Workers: **prod** source is `server/prod-martialmatch`, **dev** is `server/dev-martialmatch`, **dev-test** (fixtures) is `server/dev-test-martialmatch`.

**Caching:** The app relies on **server-side** caching (Cloudflare edge / Worker cache for stable HTML and schedule JSON) and **client-side** caching (browser HTTP cache via response headers) so repeat visits do not hammer the original site. Live or frequently changing data (e.g. fights) is not cached the same way.

### Dev vs prod styling (two repos)

After `app.css`, `theme-loader.js` sends a `HEAD` request for **`prod.css`** at the site root (next to `app.css`).

| `prod.css` at root | URL | Extra CSS |
|--------------------|-----|-----------|
| Yes (200) | any | `prod.css` — production look (file can be empty). |
| No | without `mode=test` | `dev.css` |
| No | with `mode=test` | `dev.css` + `dev-test.css` |

**Dev repo:** commit `dev.css`, `dev-test.css`, and `theme-loader.js`; do **not** commit `prod.css`. Use `prod.css.example` as a template.

**Prod repo:** after cloning or merging from dev, add **`prod.css`** (copy from `prod.css.example` or leave empty) and commit it there only.

### Test worker fixtures

The test Cloudflare Worker serves files from `server/test-martialmatch/data/` via `https://raw.githubusercontent.com/andruwik777/dev.martialmatch.com/master/server/test-martialmatch/data/...` (use `main` instead of `master` in `worker.js` if that is your default branch).

**Regenerate everything** (from the repo root):

```bash
python server/test-martialmatch/build_test_data.py
```

**What the script does**

| Input | Output under `data/` |
|--------|-------------------------|
| `research/html.starting.list` | Per-event `starting-lists.html` (full / first ⅔ / last ⅔ / empty rows) |
| `research/json.harmonogram`, `research/json.przebieg.walk` | `schedules.json` / `fights.json` for the “full data” event and variants |
| Slice of `research/html.pl.events` | `events.html` (list of four test events only) |

**What to edit when things break**

1. **`server/test-martialmatch/build_test_data.py`**
   - `EVENTS_HTML_FIRST_LINE` / `EVENTS_HTML_LAST_LINE` — 1-based line numbers in `research/html.pl.events` for the block that contains exactly the event cards you want in `events.html`. If MartialMatch changes the HTML, re-open that file in an editor, find the first `<div class="columns is-centered is-gapless">` of your first card and the closing `</div>` after the last card, note line numbers, and update both constants.
   - `SLUGS` — folder names under `data/` and the slugs must stay in sync with **`server/test-martialmatch/worker.js`** (`NUMERIC_TO_SLUG` and `ALLOWED_SLUGS`).
   - Source paths at the top (`SRC`, `EVENTS_SRC`, `SCHED_SRC`, `FIGHTS_SRC`) if you snapshot new research files.

2. **`server/test-martialmatch/worker.js`**
   - `REPO_RAW_BASE` — must match this repo on GitHub (`andruwik777/dev.martialmatch.com`) and default branch.
   - `NUMERIC_TO_SLUG` — must list every numeric event id the app can request in test mode and match the folders under `data/`.

3. **`server/martialmatch/worker.js`** (prod proxy) — deploy to your prod Worker; update `allowedOrigins` if the app is served from a custom domain.

After changing fixtures, run the script, commit `data/`, push, then the test Worker can fetch the new raw URLs.

## Challenges & learnings

*This section is a running log of non-obvious issues while building the app; it will keep growing.*

1. **CORS** — Browsers block calling the official site’s HTML/API from a GitHub Pages origin. **Mitigation:** route requests through a **Cloudflare Worker** proxy on a Workers origin, with an explicit `Access-Control-Allow-Origin` for allowed page origins (not `*` when using credentials-sensitive patterns).

2. **Bad CORS advice from ChatGPT ready-to-go solution** — A copy-paste suggestion along the lines of `const allowOrigin = allowedOrigins.includes(origin) ? origin : '*'` is **unsafe**: falling back to `*` (or reflecting arbitrary origins) breaks the point of an allowlist and can create a **cross-origin data leak**. Stick to **either** a matched allowed origin **or** no CORS header / deny.

3. **Two public repos instead of fork** — GitHub does not let you fork your own repo into the same account in the usual way. **Approach:** keep **two** repositories and treat “release” as **merging** early work from dev into prod:
   - **PROD (stable):** [github.com/andruwik777/martialmatch.com](https://github.com/andruwik777/martialmatch.com) → GitHub Pages e.g. `https://andruwik777.github.io/martialmatch/…`
   - **DEV (early access):** [github.com/andruwik777/dev.martialmatch.com](https://github.com/andruwik777/dev.martialmatch.com) → `https://andruwik777.github.io/dev.martialmatch.com/…`

4. **URL shape vs the official site** — Reuse the **same path** as the official site so you only swap the host: conceptually, prefix `https://andruwik777.github.io/` **before** the original host, so the path after it stays `…/pl/events/…`:
   - Original: `https://martialmatch.com/pl/events`
   - Wrapper (if the Pages project name matches): `https://andruwik777.github.io/martialmatch.com/pl/events`  
   In practice, GitHub Pages puts the **repository name** as the first path segment (`…/github.io/<repo>/pl/events/…`), e.g. stable **`martialmatch`** → `https://andruwik777.github.io/martialmatch/pl/events`.

5. **`mode=test` and fixture data** — The **dev** repo includes a **test data** path: the Worker serves **pre-collected** snapshots from the official site, so in that mode the browser **does not** talk to the live official origin for those resources. Enable with the query parameter **`mode=test`**.

6. **Two Cloudflare Workers** — Same split as above:
   - **Dev / test** — small, curated fixture set covering many edge cases (served from repo raw + test worker).
   - **Prod** — thin **proxy** to the **live** official site.

7. **CSS theming** — The dev app UI uses one visual theme; **`mode=test`** uses **another** theme so test mode is visually distinct at a glance.

8. **MartialMatch API + `mode=test`** — Starting lists (participants by category) moved from **HTML** to **JSON**; the viewer had to consume the new shape, and **`mode=test`** needed the same — including **adapting fixtures** (JSON snapshots / conversion from legacy HTML) so the test Worker still serves coherent data.

9. **Multi-day events — category schedule on the Schedule tab** — The harmonogram/schedule view shows **per-day / per-window category block timing** for competitions that span multiple days, so the long schedule stays readable (not a single undifferentiated wall of rows).

10. **WebSocket proxy for live scoreboard** — A small **Node** `wss://` proxy in this repo (see [server/README-wss.md](server/README-wss.md) and `WSS_BASE_BY_MODE` in [config.js](config.js)) is required because the **official scoreboard** updates over **WebSocket** (time, points, status, etc.), which the static GitHub Pages origin cannot use directly.

11. **“Observer” / fan-out on the WebSocket proxy** — The proxy maintains **one upstream socket** to MartialMatch and, for each **scoreboard channel** clients subscribe to, **broadcasts** each upstream message to **every** connected browser that asked for that channel. One upstream message can therefore update many interested clients efficiently.

12. **Autodeploy for three environments** — **Front end:** this repo on **GitHub Pages** (free; **dev** and **dev-test** on `master`, **prod** from the separate release repo/branch as documented above). **HTTP** proxy: **Cloudflare Workers** (free tiers). **WebSocket** proxy: the Node service on **Render** (free tier) — all three can track pushes so a full-stack change can roll out in parallel when you need it.

13. **Render *root directory* vs Cloudflare *every push*** — If you set a [root directory](https://render.com/docs/monorepo-support#setting-a-root-directory) for the WebSocket service, Render’s **autodeploy only runs when changed files fall under that directory**; changes elsewhere in a monorepo are ignored. **Cloudflare Workers** tied to the repo typically **redeploy on any push** to the watched branch. Know which half of the stack is “noisy” when you monorepo other code next to the proxy.

14. **Connection lifetime vs the official upstream** — The custom WebSocket proxy does **not** drop browser connections on a **~1 minute** cadence the way the original upstream behavior can feel like; it **tracks subscriptions** and **prunes** clients that have actually disconnected so resources do not leak.

15. **Debug-level UI: HTTP refresh + WSS “traffic”** — On the **Fights** tab, **spinning** refresh by the label reflects **in-flight** `/fights` fetches, and a **small status dot** reflects connection state; a **throttled** neutral pulse on send/receive helps confirm live WSS **without** flooding the screen during busy mats.

## Releasing a new version (dev → prod)

**Dev repo:** [github.com/andruwik777/dev.martialmatch.com](https://github.com/andruwik777/dev.martialmatch.com)  
**Prod repo:** [github.com/andruwik777/martialmatch.com](https://github.com/andruwik777/martialmatch.com) — add it as remote **`release-origin`**. Default branch on both workflows below is **`master`**.

### One-time setup (local dev clone)

1. Add the production remote:

   ```bash
   git remote add release-origin https://github.com/andruwik777/martialmatch.com.git
   ```

2. Create a local **`release`** branch (from up-to-date **`master`** if you prefer):

   ```bash
   git checkout master
   git pull origin master
   git checkout -b release
   ```

or if you setup a new env on other PC then

   ```bash
   git fetch release-origin
   git checkout -b release release-origin/release
   ```


3. Set upstream for **`release`** to **`release-origin`** (first push):

   ```bash
   git push -u release-origin release
   ```

   Later, when publishing a prepared release commit directly to prod’s **`release`**, you typically use:

   ```bash
   git push release-origin HEAD:release
   ```

**Verify:**

```bash
git remote -v
git branch -vv
```

### Steps to cut a new release

Work in the **dev** repo clone, on branch **`release`** (or create/update it from **`master`**).

1. Switch to the release branch:

   ```bash
   git checkout release
   ```

2. Bring in the latest dev work:

   ```bash
   cp README.md README.md.keep-ours && git merge master -X theirs --no-edit && mv README.md.keep-ours README.md && git add README.md && git commit --amend --no-edit
   ```

   While **`release`** is checked out, **`theirs`** is **`master`**: if Git reports conflicts, this merge strategy prefers **`master`**’s version of the conflicted hunks (release-only tweaks like **`prod.css`** / **`config.js`** you re-apply in the steps below).

3. Point **`config.js`** at the **prod** Cloudflare Worker URLs (substring replace only — indentation stays the same). Typical mapping for this project:

   ```bash
   sed -i 's|https://dev-martialmatch-v1.andruwik777.workers.dev|https://prod-martialmatch-v1.andruwik777.workers.dev|g' config.js
   sed -i 's|https://dev-test-martialmatch-v1.andruwik777.workers.dev|https://prod-martialmatch-v1.andruwik777.workers.dev|g' config.js
   ```

   Uses **GNU** `sed -i` (Git Bash on Windows, Linux). On **macOS** use `sed -i ''` before the script on each line, e.g. `sed -i '' 's|…|…|g' config.js`.

   Adjust hostnames if your deployed Workers use different names; keep them aligned with **`server/`** and what you actually deployed.

4. Rename the prod theme file so GitHub Pages loads **`prod.css`** (see [Dev vs prod styling](#dev-vs-prod-styling-two-repos)):

   ```bash
   git mv prod.css.example prod.css
   ```

5. Replace **`README.md`** with a **short stub**: the prod repo only needs to publish **`release`** to GitHub Pages — it should not carry a second copy of the full dev README (that drifts and duplicates). Point readers at the dev repo instead:

   ```bash
   printf '%s\n' \
     '# martialmatch.com (release publish)' \
     '' \
     'This repository exists so the **`release`** branch is built as **GitHub Pages** for the stable site.' \
     '' \
     '**Development, documentation, and issues:** [github.com/andruwik777/dev.martialmatch.com](https://github.com/andruwik777/dev.martialmatch.com)' \
     > README.md
   ```

6. Commit with a release message, then create an **annotated or lightweight** tag with the same version (replace `v1.0.0` everywhere below):

   ```bash
   git add config.js prod.css README.md
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   ```

7. Push the **current HEAD** to prod’s **`release`** and push the **tag** (tag name must match step 6):

   ```bash
   git push release-origin HEAD:release
   git push release-origin v1.0.0
   ```

   This updates **[github.com/andruwik777/martialmatch.com](https://github.com/andruwik777/martialmatch.com)** `release` from your local `HEAD` and publishes the tag on **`release-origin`**.

8. Return to daily work:

   ```bash
   git checkout master
   ```

One-liner release script (set the valid tag at the beginning): 
   ```bash
   tag=v2.1.17 && git checkout release && cp README.md README.md.keep-ours && git merge master -X theirs -m "Merge master to release for release with tag $tag" && mv README.md.keep-ours README.md && git add README.md && git commit --amend --no-edit && git tag "$tag" && git push release-origin HEAD:release && git push release-origin "$tag" && git checkout master
   ```

9. **Cloudflare Worker (prod)** — easy to forget: **`git push` does not deploy the proxy.** After the release, copy the repo’s **`server/prod-martialmatch-v1/worker.js`** into the **`prod-martialmatch-v1`** Worker in the Cloudflare dashboard, then click **Deploy** so production matches what you ship in **`server/`**.  
   Direct link (this project’s prod Worker → **Production**): [dash.cloudflare.com → prod-martialmatch-v1](https://dash.cloudflare.com/6b47963c94d644f8d9b7f1cf6f1405bd/workers/services/edit/prod-martialmatch-v1/production).

**Notes**

- **`release-origin`** is used for **every** push to the prod GitHub repo in this workflow; do not mix in `release_origin`.
- If you merge **`release`** back into **`master`** on the **dev** repo, **`prod.css`** can reappear on dev—usually you keep **`prod.css`** only on commits that exist on **`release-origin`**, or you revert **`prod.css`** on **`master`** after the release.
- Update **`REPO_RAW_BASE`** (and similar) in any **test** Worker bundled for prod if fixture raw URLs must point at the **prod** repo or branch.
- Deploying Workers is separate from **`git push`**; align Worker code with what you kept under **`server/`**.
