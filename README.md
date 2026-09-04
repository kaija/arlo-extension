# Arlo — Chrome side panel extension

Arlo is an agentic browser operator that lives in the Chrome side panel. You give it a task in
plain language and it works **the tab you are looking at** — clicking, typing, scrolling, changing
pages — until the task is done.

It is not a chat assistant, so the whole product rests on one promise:

> You always know what it is about to do, what it has already done, and you can stop it before it
> does anything it cannot take back.

The interaction design lives in [`design/arlo-sidepanel-design-prompt.md`](design/arlo-sidepanel-design-prompt.md).

## Status

This repository is the working extension: the state machine and gate policy are implemented and
tested, the side panel drives a real run, the content script performs page actions, and the planner
can use Anthropic Messages, OpenAI Responses, or OpenAI-compatible Chat Completions.

## Requirements

- Node.js 24 (`.nvmrc` pins it; `nvm use` or `fnm use` picks it up)
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
worker or content script need the **Reload** button on `chrome://extensions`.

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
├── manifest.config.ts     # the manifest, generated into dist at build time
├── core/                  # pure domain logic — no chrome APIs, fully unit tested
│   ├── types.ts           #   Task, Plan, Step, RunState vocabulary
│   ├── run-machine.ts     #   the state machine as a pure reducer
│   ├── gate-policy.ts     #   which actions are irreversible
│   └── suggestions.ts     #   site-aware example tasks
├── background/            # service worker: routing, run execution, planning and model APIs
├── content/               # page actions and the on-page highlight
├── sidepanel/             # React UI for the whole run lifecycle
├── options/               # settings: the user's brakes
└── shared/                # typed messaging and settings storage
```

The rule that keeps this navigable: **`core/` never imports `chrome`**. Anything that touches a
browser API lives in `background/`, `content/` or a UI folder, which is also why `core/` is the part
under a coverage threshold.

## How a run works

```
idle → planning → awaiting_approval → running ⇄ gated
                                         ├→ needs_help → running
                                         ├→ paused → running
                                         ├→ stopped
                                         └→ done
```

- **Plan** — every task is a numbered plan, approved once before anything happens. Steps that need
  confirmation are flagged _in the plan_, not sprung on the user mid-run.
- **Gate** — before an irreversible action (submit, order, send, delete, sign in, change settings)
  the run stops and waits. It never continues on its own. Defaults live in
  [`src/core/gate-policy.ts`](src/core/gate-policy.ts) and the user can widen them in Settings.
- **Handing back** — Arlo does not solve CAPTCHAs and never types credentials. Both hand control to
  the user, who returns it explicitly.

## Permissions

Site access is `optional_host_permissions`, requested from the onboarding screen during a user
gesture rather than at install time. The content script is registered at runtime once access is
granted, and unregistered if it is revoked
([`src/background/content-registration.ts`](src/background/content-registration.ts)).

`chrome.storage.local` holds settings and API keys the user chooses to remember; it is never synced
across Chrome profiles. A profile can instead keep its key in `chrome.storage.session`, which clears
when Chrome closes. Model requests go directly from the background worker to the profile's Base URL.

## AI connections

Settings supports multiple named AI profiles with one explicit default. Every profile selects its
wire contract, API root, model and optional API key. Model discovery is manual and never runs a
generation. Custom HTTP endpoints are allowed with a warning; changing origins clears the key and
requires the user to confirm the new data destination.

[`src/background/planner.ts`](src/background/planner.ts) validates model-produced steps and applies
the local gate policy itself. The model cannot remove confirmation from purchases, messages,
deletions or other gated actions. [`src/background/llm-client.ts`](src/background/llm-client.ts)
contains the three request/response adapters and keeps provider details out of the run controller.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request: format
check, lint, typecheck, tests with coverage thresholds, build, a manifest sanity check, and packaging.
It uploads the unpacked build, the zip and the coverage report as artifacts.

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on a `v*` tag: it verifies the
tag matches `package.json`, runs the full verify pipeline and attaches the zip to a GitHub release.

## Known version pin

`typescript` is pinned to 5.9 rather than 7.x because `typescript-eslint` still caps its peer range
at `<6.1.0`. Once typescript-eslint supports TypeScript 7, bump both together.
