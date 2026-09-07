# Arlo — Chrome side panel extension

Arlo is an AI assistant that lives in the Chrome side panel. You give it a task in plain language;
it can **read the tab you are looking at** and **open tabs** for you, and it streams its answer
back as it works.

The larger goal is an agentic browser operator that clicks, types and navigates the page under one
promise:

> You always know what it is about to do, what it has already done, and you can stop it before it
> does anything it cannot take back.

An earlier build implemented that design in full; it lives in the project's git history. What ships
today is the side-panel agent with two browser tools. The interaction design lives in
[`design/arlo-sidepanel-design-prompt.md`](design/arlo-sidepanel-design-prompt.md).

## Status

This repository is the working extension. The agent runs inside the side panel on the OpenAI
Agents SDK, with two browser tools — a three-level current-tab reader and a tab opener that keeps
every tab it creates in an Arlo tab group. There is no local process to start: an OpenAI-compatible
endpoint and a key are the whole setup.

[`docs/architecture.md`](docs/architecture.md) has the current picture: both agent paths, the two
browser tools, and where everything lives.

## Requirements

- Node.js 24 for the build only (`.nvmrc` pins it; `nvm use` or `fnm use` picks it up)
- Chrome 124+
- `zip` on PATH for packaging (`make package`)

## Getting started

```bash
nvm use && make build
```

`make` on its own lists every target. It wraps the npm scripts below, and adds what npm scripts
cannot do: it checks the active Node against `.nvmrc`, installs only when the lockfile has moved,
and skips the build when nothing under `src/` or `public/` has changed.

Then load it into Chrome:

1. Open `chrome://extensions` and switch on **Developer mode**
2. **Load unpacked** → select the `dist/` directory
3. Click the Arlo toolbar icon to open the side panel
4. Grant site access from the onboarding screen

`make dev` rebuilds on change. Chrome picks up page changes on reload; changes to the service
worker need the **Reload** button on `chrome://extensions`.

## Make targets

| Target                               | What it does                                         |
| ------------------------------------ | ---------------------------------------------------- |
| `make`                               | List every target                                    |
| `make install`                       | `npm ci`, only when the lockfile or manifest changed |
| `make build`                         | Build into `dist/`, skipped when nothing changed     |
| `make dev`                           | Both build passes in watch mode                      |
| `make package`                       | Zip `dist/` into `release/`                          |
| `make test` / `watch` / `coverage`   | Vitest, once / in watch mode / with thresholds       |
| `make lint` / `typecheck` / `format` | Individual checks                                    |
| `make fix`                           | ESLint `--fix`, then Prettier                        |
| `make verify`                        | Everything CI runs, in the same order                |
| `make release`                       | Verify, package, and print the tag command           |
| `make clean` / `distclean`           | Remove build output / also `node_modules`            |

## Scripts

The Makefile calls these, and they work directly too.

| Command                                     | What it does                                              |
| ------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                               | Both build passes in watch mode                           |
| `npm run build`                             | Production build into `dist/`                             |
| `npm run package`                           | Build, then zip to `release/arlo-extension-<version>.zip` |
| `npm run typecheck`                         | `tsc --noEmit`                                            |
| `npm run lint` / `lint:fix`                 | ESLint                                                    |
| `npm run format` / `format:check`           | Prettier                                                  |
| `npm test` / `test:watch` / `test:coverage` | Vitest                                                    |
| `npm run verify`                            | Everything CI runs, in the same order                     |
| `npm run icons`                             | Regenerate the placeholder icons in `public/icons/`       |

## Layout

```
src/
├── manifest.config.ts      # the manifest, generated into dist/ at build time
├── core/                   # pure domain logic — no chrome APIs, covered by a threshold
│   ├── chat.ts             #   the message / session vocabulary
│   └── page-suggestions.ts #   site-aware example prompts for the idle screen
├── background/             # service worker: opens the panel, lists models for Settings
├── shared/                 # typed messaging, settings storage, the two tool contracts, theme
├── sidepanel/              # React UI, the agent loop (local-agent.ts) and the two browser tools
├── options/                # settings: AI profiles, model discovery, theme
├── design-system/          # the Arlo design system, vendored from Claude Design
└── preview/                # dev-only harness; not a build input, never in dist/
```

The rule that keeps this navigable: **`core/` never imports `chrome`**. Anything that touches a
browser API lives in `background/`, `sidepanel/` or `options/`, which is also why `core/` (with
`shared/`) is the part under a coverage threshold.

[`docs/architecture.md`](docs/architecture.md) has the current picture. An earlier plan/gate/run
state machine — with a content script and the cards that drove it — lives in the project's git
history.

## Design system

Both surfaces are built on the Arlo design system, vendored into `src/design-system/` from the
`arlo-design` skill (its `DESIGN.md`, `tokens/` and `css/`).

`tokens/colors.css`, `tokens/typography.css`, `tokens/effects.css`, `base.css`, `components.css` and
`ui.css` are **byte-for-byte copies**. Update them by re-copying from the source project, never by
hand — `.prettierignore` keeps the formatter off them for the same reason. Three files are local and
each explains itself in its own header: `tokens/fonts.css` self-hosts Inter rather than fetching it
from Google Fonts on every open, `theme-dark.css` carries the dark palette, and `ui-patches.css`
fixes defects in `ui.css` (including one reproducible in the system's own component card).

The palette follows the OS unless Settings says otherwise. The choice is stored as `theme`
(`system` / `light` / `dark`) and applied as `data-arlo` on the document element — the switch
`theme-dark.css` is already built around, so setting it themes both surfaces at once.
`public/theme-boot.js` applies it before the first paint: an extension page cannot run an inline
script, and `chrome.storage` is async, so the choice is mirrored into `localStorage` for that one
job. `shared/theme.ts` owns both sides of that mirror.

There are two entry points:

| Import                     | Gives you                                                                                          | Used by      |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| `design-system/index.css`  | tokens, base, dark theme, motion                                                                   | side panel   |
| `design-system/ui-kit.css` | the above plus `.btn` / `.card` / `.field` / `.input` / `.switch` / `.badge` / `.alert` / `.table` | options page |

The side panel does **not** use the system's component classes: it is a bespoke 400px surface drawn
to `Arlo Side Panel.dc.html`, so its own components are named `panel-*`. Do not let either page
define a bare `.card`, `.btn`, `.badge` or `.alert` — those names belong to the design system.

The two pages are separate documents with separate stylesheets, and must stay that way: the panel
needs `body { overflow: hidden }` to sit in its rail, which makes any page that also loads the
panel's stylesheet unscrollable. `tests/page-isolation.test.ts` fails if either page imports the
other's code or styles.

To check either surface, run the dev server:

```bash
npx vite --port 5199
```

- <http://localhost:5199/preview/panel.html> — the side panel at the real 400 × 760 against a
  stubbed `chrome.*`. `?base=…&model=…&key=…` points it at any OpenAI-compatible endpoint;
  `?granted=0` reproduces the model-access screen.
- <http://localhost:5199/preview/options.html> — the options page against a stubbed `chrome.*`.

Both are dev-only: `vite.config.ts` lists the build inputs explicitly, so nothing under
`src/preview/` reaches `dist/`.

## How a turn works

The panel owns the turn. `useChat.send()` calls `runLocalTurn()` in
[`src/sidepanel/local-agent.ts`](src/sidepanel/local-agent.ts), which runs the OpenAI Agents SDK
loop with two browser tools and streams the reply back as growing snapshots. `windowId` is closed
over from the panel, never taken from a tool argument, so a read or an open cannot be aimed at a
window the user is not looking at. Closing the panel ends the turn — the service worker cannot own
it, because MV3 tears the worker down after about thirty seconds idle.

The full safety model — a plan approved before anything happens, a gate before every irreversible
action, explicit hand-off for CAPTCHAs and credentials — is not shipped; it exists in an earlier
build in the project's git history. See [`docs/architecture.md`](docs/architecture.md) for what
runs today.

## Permissions

```
permissions               activeTab, scripting, sidePanel, storage, tabGroups
optional_host_permissions http://*/*, https://*/*
```

Nothing in the optional list is granted at install, and Arlo never asks for the wildcard: it is
declared only so a single concrete origin — the endpoint the current profile points at — can be
requested, from the model-access screen during a user gesture. A page read is a one-shot
`chrome.scripting` injection under `activeTab`, so it lapses when the tab navigates to another
origin; there is no content script. Either grant is revocable from `chrome://extensions`.

`chrome.storage.local` holds settings and API keys the user chooses to remember; it is never synced
across Chrome profiles. A profile can instead keep its key in `chrome.storage.session`, which clears
when Chrome closes. Model requests go directly from the background worker to the profile's Base URL,
so refreshing a profile's model list asks for that one provider origin at the moment it is needed.

## AI connections

Settings supports multiple named AI profiles with one explicit default. Every profile selects its
wire contract, API root, model and optional API key. Model discovery is manual and never runs a
generation. Custom HTTP endpoints are allowed with a warning; changing origins clears the key and
requires the user to confirm the new data destination.

The turn runs on the OpenAI Agents SDK inside the panel
([`src/sidepanel/local-agent.ts`](src/sidepanel/local-agent.ts)); the model is reached directly
through an `OpenAI` client with tracing disabled. Anthropic profiles are still offered for model
discovery but cannot run a turn — the SDK speaks only the OpenAI wire formats. The service
worker's own call, `GET <endpoint>/models` for Settings, lives in
[`src/background/llm-client.ts`](src/background/llm-client.ts).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request: format
check, lint, typecheck, tests with coverage thresholds, build, a manifest sanity check, and packaging.
It uploads the unpacked build, the zip and the coverage report as artifacts.

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on a `v*` tag: it verifies the
tag matches `package.json`, runs the full verify pipeline and attaches the zip to a GitHub release.

## Known version pin

`typescript` is pinned to 5.9 rather than 7.x because `typescript-eslint` still caps its peer range
at `<6.1.0`. Taking the major on its own makes `npm ci` fail with `ERESOLVE`, so Dependabot is told
to skip TypeScript majors in `.github/dependabot.yml`. Once typescript-eslint supports TypeScript 7,
bump both together and drop that ignore rule.
