# MartialMatch viewer

A lightweight web front end for [martialmatch.com](https://martialmatch.com) data, focused on **filtering by multiple athletes**, **shareable links**, and **favorites** for people you follow across events. This helps a coach stay focused during a competition, lets parents open the same filtered view from a link, and makes it easier to see which events your athletes are registered for. Have fun! 🤼🥋🥊

**Live site (Stable):** [andruwik777.github.io/martialmatch.com](https://andruwik777.github.io/martialmatch.com)

<a href="https://youtu.be/vE49NYUGRHg">
  <img src="https://github.com/andruwik777/dev.martialmatch.com/blob/master/demo.jpg" width="45%">
</a>

## Disclaimer

This project is **not affiliated with** MartialMatch. Functionality depends on MartialMatch’s public HTML and API; changes on their side may break scraping or views.

**Compliance (proxy):** The official **[Regulamin / terms and conditions](https://martialmatch.com/pl/terms-and-conditions)** do not forbid using a **proxy server** to reach the site, and do not spell out a separate **software or API license** that would prohibit a third-party, read-only viewer built on the same public URLs your browser would load. This app is meant as a convenience layer (filtering, shareable links) over that public surface—not to bypass paywalls, authentication, or stated restrictions. *MartialMatch can change their terms at any time; re-read the Regulamin if in doubt. This is the maintainer’s reading, not legal advice.*

## Why this exists

The official MartialMatch site does not provide functionality to filter **live fights** and **schedule** by a **set of people at once**. For a **coach at a competition** with a group of kids (or anyone following several athletes), that is awkward: you keep searching manually for who fights when.

The main view is **[Current matches](pl/events/current-matches/)** with three tabs:

| Tab | What you see | Filter in URL |
|-----|----------------|---------------|
| **Events** | All upcoming events; rows narrow to events where selected athletes are registered | `events_filter` |
| **Fights** | Live / polled fight list for the **active event** (`slug` in URL) | `slug_filter` |
| **Schedule** | Category blocks and athletes on the harmonogram for that same event | `slug_filter` |

On **Events**, pick athletes and apply — the list shows **which competitions they entered**. Switch to **Fights** or **Schedule** for the active event to see **only their fights or category rows**. The two filter params are **separate** (shared deep links can carry both; each tab reads its own).

**Favorites** (☆ in the filter list, stored in **localStorage**, not the URL) help you quickly narrow the picker to people you track often — useful when the starting list is long.

Filters are stored in the **URL** (`events_filter` / `slug_filter`), so you can **share a link** with friends or parents and they open the **same filtered view** without redoing the setup.

**PWA:** the app can be installed for a more fullscreen, phone-friendly layout (minimal service worker; see `pwa.js`).

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

- **Static UI:** this repo, **GitHub Pages** (dev on **`master`**, prod on the separate repo’s **`release`** branch).
- **HTTP** API proxy: **Cloudflare Workers** — autodeploy from GitHub on **every push** to the watched branch (see `BASE_BY_MODE` in [config.js](config.js)).
- **WebSocket** scoreboard proxy: **[Render](https://render.com/)** — autodeploy from GitHub when commits touch **`server/`** (Render root directory; see [server/README-wss.md](server/README-wss.md) and `WSS_BASE_BY_MODE` in [config.js](config.js)).

### Autodeploy from GitHub

Proxies deploy automatically from this repository — **no manual dashboard upload or copy-paste**.

| Component | Platform | Autodeploy trigger |
|-----------|----------|-------------------|
| **Static UI** | GitHub Pages | Push to **`master`** (dev) or **`release`** (prod repo) |
| **HTTP proxy** | Cloudflare Workers | **Every commit** on the watched branch |
| **WebSocket proxy** | Render | Commits that change files under **`server/`** only ([root directory](https://render.com/docs/monorepo-support#setting-a-root-directory) = `server`) |

After `git push`, wait for GitHub Pages / Cloudflare / Render to finish before testing prod. UI-only changes do not redeploy Render; Worker-only changes do not rebuild the static site.

See [server/README-wss.md](server/README-wss.md) for Render start commands per environment.

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

Use **`mode=test`** in the page URL to point HTTP requests at the **fixture Worker** (curated snapshots, no live MartialMatch).

Proxy servers live under **`server/*-martialmatch-v1/`** as Cloudflare Workers:

| Mode | Worker source | Upstream |
|------|----------------|----------|
| **prod** (default) | `server/prod-martialmatch-v1/` | Live `martialmatch.com` |
| **dev** (same as prod upstream in this repo’s `config.js`) | `server/dev-martialmatch-v1/` | Live site + optional edge/browser cache |
| **test** (`mode=test`) | `server/dev-test-martialmatch-v1/` | Fixtures from GitHub raw (`data/`) — **no** Worker cache |

WebSocket proxies are sibling Node services: `server/dev-martialmatch-v1/wss-proxy.js`, `server/dev-test-martialmatch-v1/wss-proxy.js`, `server/prod-martialmatch-v1/wss-proxy.js` (shared core in `server/_shared/wss-proxy-core.js`).

**Caching:** **Prod/dev** Workers can cache stable routes (events index HTML, starting lists, schedules) at the edge and optionally in the browser (`Cache-Control`, `X-Cache: HIT/MISS`). **Fights** stay **`no-store`**. The **test** Worker always **re-fetches** fixtures from raw GitHub (passthrough) — useful to exercise slow aggregate loads and loading states. Live or frequently changing data is not cached the same way on prod/dev.

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

The test Cloudflare Worker serves files from **`server/dev-test-martialmatch-v1/data/`** via raw GitHub URLs configured in **`server/dev-test-martialmatch-v1/worker.js`** (`REPO_RAW_BASE`; use `main` instead of `master` if that is your default branch).

**Regenerate HTML fixture slices** (from the repo root):

```bash
python server/dev-test-martialmatch-v1/build_test_data.py
```

**Refresh API-shaped starting lists** after HTML snapshots change:

```bash
python server/dev-test-martialmatch-v1/convert_starting_lists_html_to_json.py
```

**What `build_test_data.py` does**

| Input | Output under `data/` |
|--------|-------------------------|
| `research/html.starting.list` | Per-event `starting-lists.html` (full / first ⅔ / last ⅔ / empty rows) |
| `research/json.harmonogram`, `research/json.przebieg.walk` | `schedules.json` / `fights.json` for the “full data” event and variants |
| Slice of `research/html.pl.events` | `data/pl/events.html` (event index for test) |

**What to edit when things break**

1. **`server/dev-test-martialmatch-v1/build_test_data.py`**
   - `EVENTS_HTML_FIRST_LINE` / `EVENTS_HTML_LAST_LINE` — 1-based line numbers in `research/html.pl.events` for the block that contains the event cards you want in `pl/events.html`. If MartialMatch changes the HTML, re-open that file, find the first card block and the closing `</div>` after the last card, note line numbers, and update both constants.
   - `SLUGS` — folder names under `data/` must stay in sync with **`server/dev-test-martialmatch-v1/worker.js`** (`NUMERIC_TO_SLUG`).
   - Source paths at the top (`SRC`, `EVENTS_SRC`, `SCHED_SRC`, `FIGHTS_SRC`) if you snapshot new research files.

2. **`server/dev-test-martialmatch-v1/worker.js`**
   - `REPO_RAW_BASE` — must match this repo on GitHub and default branch.
   - `NUMERIC_TO_SLUG` — every numeric event id the app can request in test mode, matching folders under `data/`.

3. **`server/prod-martialmatch-v1/worker.js`** (prod proxy) — edit CORS allowlist as needed (`ALLOWED_CORS_ORIGINS` / worker CORS helpers); **push** and the Worker autodeploy picks it up.

After changing fixtures, run the scripts, commit `data/`, push — the test Worker fetches the new raw URLs on the next deploy.

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

5. **`mode=test` and fixture data** — The **dev-test** Worker serves **pre-collected** JSON/HTML from `server/dev-test-martialmatch-v1/data/` (via GitHub raw), so the browser **does not** hit the live official origin for those routes. Enable with **`?mode=test`**.

6. **Three proxy variants** — **Prod** and **dev** Workers proxy the **live** site (with optional edge cache on stable routes). **Dev-test** serves **fixtures** only (no Worker cache). All three have a matching **WebSocket** service on Render for scoreboard (`WSS_BASE_BY_MODE` in [config.js](config.js)).

7. **CSS theming** — The dev app UI uses one visual theme; **`mode=test`** uses **another** theme so test mode is visually distinct at a glance.

8. **MartialMatch API + `mode=test`** — Starting lists (participants by category) moved from **HTML** to **JSON**; the viewer had to consume the new shape, and **`mode=test`** needed the same — including **adapting fixtures** (JSON snapshots / conversion from legacy HTML) so the test Worker still serves coherent data.

9. **Multi-day events — category schedule on the Schedule tab** — The harmonogram/schedule view shows **per-day / per-window category block timing** for competitions that span multiple days, so the long schedule stays readable (not a single undifferentiated wall of rows).

10. **WebSocket proxy for live scoreboard** — A small **Node** `wss://` proxy in this repo (see [server/README-wss.md](server/README-wss.md) and `WSS_BASE_BY_MODE` in [config.js](config.js)) is required because the **official scoreboard** updates over **WebSocket** (time, points, status, etc.), which the static GitHub Pages origin cannot use directly.

11. **“Observer” / fan-out on the WebSocket proxy** — The proxy maintains **one upstream socket** to MartialMatch and, for each **scoreboard channel** clients subscribe to, **broadcasts** each upstream message to **every** connected browser that asked for that channel. One upstream message can therefore update many interested clients efficiently.

12. **Autodeploy from GitHub** — **Front end:** GitHub Pages (**dev** on `master`, **prod** from the release repo/branch). **HTTP** proxy: Cloudflare Workers redeploy on **every push**. **WebSocket** proxy: Render redeploys when **`server/`** changes (root directory `server`). No manual Worker deploy in the dashboard.

13. **Render `server/` root vs Cloudflare every push** — Render’s [root directory](https://render.com/docs/monorepo-support#setting-a-root-directory) is **`server`**, so autodeploy runs only when commits touch that tree; frontend or docs changes elsewhere skip Render. Cloudflare Workers redeploy on **any** push to the watched branch. Keep proxy code under **`server/`**, UI at repo root.

14. **Connection lifetime vs the official upstream** — The custom WebSocket proxy does **not** drop browser connections on a **~1 minute** cadence the way the original upstream behavior can feel like; it **tracks subscriptions** and **prunes** clients that have actually disconnected so resources do not leak.

15. **Debug-level UI: HTTP refresh + WSS “traffic”** — On the **Fights** tab, **spinning** refresh by the label reflects **in-flight** `/fights` fetches, and a **small status dot** reflects connection state; a **throttled** neutral pulse on send/receive helps confirm live WSS **without** flooding the screen during busy mats.

16. **Two URL filters, one picker** — **`events_filter`** (Events tab: which event rows stay visible) and **`slug_filter`** (Fights / Schedule: fights and harmonogram rows for the active event) are **independent** query params. The filter panel reuses the same athlete list UI, but **Apply** writes the param for the **current tab**. Deep links can include both; opening aggregate on Events with `events_filter` pre-set must load **every** event’s starting list before row visibility is correct.

17. **Favorites and `athleteKey`** — URL filters use MartialMatch **`publicId`** (per registration). The same human can have **different `publicId`s** on different events, so favorites cannot be “just publicId”. The app stores favorites in **`localStorage`** (`mm_cm_favorites_v1`) under a heuristic **`athleteKey`**: normalized `firstName|lastName|academyId` (see `athleteKeyFromParts` in `current-matches.js`). That lets ☆ follow a person across events in the picker; it is **not** guaranteed unique (name collisions, academy changes) but works well for coach/parent workflows. **Show favorites only** is a view toggle in the filter panel, not part of the shareable URL.

18. **Tabs → filter → content** — On Current matches, **Events / Fights / Schedule** tabs sit **above** the filter toolbar so context is clear per tab. Filter button labels state intent explicitly (e.g. `Filter fights by participants` vs `Filtered fights by N participants`). An **active event** card in the header tracks `slug`; the app auto-selects the first event when the list loads so Fights/Schedule stay usable.

19. **Events-tab aggregate load** — On Events, opening the filter loads **all** starting lists to build one merged athlete pool (`ensureAggregateParticipantMaps`). Until that finishes, the panel shows a loading hint and hides Apply/Clear — important for **`mode=test`** when every fixture fetch goes to GitHub raw without edge cache.

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

   Adjust hostnames if your deployed Workers use different names; keep them aligned with **`server/`** in this repo (autodeploy reads from GitHub).

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

One-liner release script (version marker below; bump patch, commit on **master**, merge to **release**, tag, push prod). Run from repo root in **Git Bash** — copy only the command line inside the code block:

<!-- release-version: v3.0.10 -->

   ```bash
   git checkout master && git pull --ff-only origin master && README=README.md && current="$(grep -m1 'release-version:' "$README" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+')" && ver="${current#v}" && IFS='.' read -r major minor patch <<< "$ver" && patch=$((patch + 1)) && tag="v${major}.${minor}.${patch}" && sed -i "s/release-version: ${current}/release-version: ${tag}/" "$README" && grep -m1 -q "release-version: ${tag}" "$README" || { echo "Version bump failed"; exit 1; } && git add "$README" && git commit -m "Prepare new release ${tag}" && git push origin master && git checkout release && cp README.md README.md.keep-ours && git merge master -X theirs -m "Merge master to release for release with tag ${tag}" && mv README.md.keep-ours README.md && git add README.md && git commit --amend --no-edit && git rev-parse "${tag}" >/dev/null 2>&1 && { echo "Tag ${tag} already exists"; exit 1; } || git tag "${tag}" && git push release-origin HEAD:release && git push release-origin "${tag}" && git checkout master
   ```

9. **Proxies** — no manual step. Pushing to **`release-origin`** triggers GitHub Pages and Cloudflare Worker autodeploy. Render redeploys automatically when the release commit includes changes under **`server/`**.

**Notes**

- **`release-origin`** is used for **every** push to the prod GitHub repo in this workflow; do not mix in `release_origin`.
- If you merge **`release`** back into **`master`** on the **dev** repo, **`prod.css`** can reappear on dev—usually you keep **`prod.css`** only on commits that exist on **`release-origin`**, or you revert **`prod.css`** on **`master`** after the release.
- Update **`REPO_RAW_BASE`** (and similar) in any **test** Worker bundled for prod if fixture raw URLs must point at the **prod** repo or branch.
- Proxy source of truth is **`server/`** on GitHub; Cloudflare and Render autodeploy from pushes — no separate manual deploy step.
