# Architecture

Arlo is a Chrome MV3 extension and nothing else. The agent loop, its tools and the model call all
run inside the side panel document. There is no companion process, no native binary, and nothing
for a user to install beyond the extension itself.

## The whole picture

```
┌─ Chrome ──────────────────────────────────────────────────────────────────┐
│                                                                           │
│  Side panel  (sidepanel/index.html)          Options page                 │
│  ├── useChat        owns one turn            ├── LLM profiles             │
│  ├── local-agent    the agent loop           ├── model discovery          │
│  ├── page-reader    read_current_tab         └── theme                    │
│  └── tab-opener     open_new_tab                                          │
│                                                                           │
│  Service worker  (background.js) — two jobs, both small                   │
│  ├── opens the panel on the toolbar click (that is what grants activeTab) │
│  └── GET <endpoint>/models  for the settings page                         │
│                                                                           │
│  chrome.storage.local — settings and LLM profiles                         │
│  chrome.storage.session — API keys a profile chooses not to remember      │
└───────────────────────────────────────────────────────────────────────────┘
                    │                                  │
                    │ tools                            │ model
                    ▼                                  ▼
      chrome.scripting / chrome.tabs      the profile's own endpoint
      chrome.tabGroups                    (OpenAI-compatible, HTTPS)
```

The service worker stays small on purpose. MV3 tears a worker down after roughly thirty seconds
idle and an agent turn runs for minutes, so the panel owns the turn. The cost is that closing the
panel ends it.

## A turn

```
useChat.send(prompt)
  │
  ├─ chrome.windows.getCurrent()          the panel's own window, resolved once
  │
  └─ runLocalTurn(profile, windowId, prompt, history, handlers, signal)
       │
       ├─ setTracingDisabled(true)        the SDK would POST traces to OpenAI otherwise
       ├─ OpenAIProvider({ openAIClient })
       │    └── new OpenAI({ baseURL, apiKey, dangerouslyAllowBrowser: true })
       │
       └─ run(agent, input, { stream: true, signal })
            │
            ├── output_text_delta ──────► handlers.onText(snapshot)  ──► transcript
            │
            ├── read_current_tab ──────► readCurrentTab(windowId, args)
            │                              chrome.scripting.executeScript under activeTab
            │                              → Turndown for the text levels
            │
            └── open_new_tab ──────────► openAgentTab(windowId, args)
                                           chrome.tabs.create
                                           → chrome.tabs.group
                                           → chrome.tabGroups.update  ("Arlo", blue)
```

`windowId` is closed over from the panel, never taken from a tool argument, so the agent cannot
aim a read or an open at a window the user is not looking at. `history` is the thread the previous
turn returned; `reset()` drops it.

Text arrives as growing snapshots rather than deltas, because that is what the transcript renders:
each `onText` replaces the reply rather than appending to it.

## The two browser tools

| Tool               | Implementation             | Chrome surface                                           | Notes                                                             |
| ------------------ | -------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `read_current_tab` | `sidepanel/page-reader.ts` | `chrome.scripting.executeScript` under `activeTab`       | `compact` / `detailed` / `html`; paged by `offset` + `snapshotId` |
| `open_new_tab`     | `sidepanel/tab-opener.ts`  | `chrome.tabs.create` → `tabs.group` → `tabGroups.update` | HTTP(S) only; every tab joins the blue **Arlo** group             |

Both are declared to the model with strict JSON schemas. A strict schema cannot mark a field
optional, so the model sends `null` for the ones it does not want and `local-agent.ts` strips them
before the panel's own parsers see them.

There is no content script. A page read is a one-shot injection into the tab the user granted with
a toolbar click, so access lapses when that tab navigates to another origin.

## Permissions

```
permissions               activeTab, scripting, sidePanel, storage, tabGroups
optional_host_permissions http://*/*, https://*/*
```

Nothing in the optional list is granted at install, and Arlo never asks for the wildcard. It is
declared only so a _single concrete origin_ can be requested: the endpoint the current profile
points at. The panel asks on the model-access screen before the first turn; the settings page asks
the same way before listing models. Either grant is revocable from `chrome://extensions`.

`tabGroups` is what lets the opener name and colour its group. Creating a tab needs no `tabs`
permission, and Arlo does not ask for one — `tabs` would mean reading every tab's URL and title.

## Where things live

```
src/
├── manifest.config.ts     generated manifest — the single source of truth
├── background/            service worker: panel opening, model discovery
├── shared/                settings, model-access, the two tool contracts
├── sidepanel/             the panel, the agent loop, the two tools
├── options/               settings UI
├── design-system/         tokens, icons, shared CSS
└── preview/               dev-only harness: both pages against a stubbed chrome.*
```

An earlier design — a run machine, a gate policy, a content script and the plan/run/gate cards —
lives in the project's git history rather than the tree.

## Known gaps

- **Anthropic profiles cannot run a turn.** The Agents SDK speaks the OpenAI wire formats, so
  `anthropic-messages` needs a `Model` adapter. The contract is still offered — stored profiles
  keep working for model discovery — and the profile editor says so, but a turn stops with an
  error.
- **The API key lives in the panel.** It is read from `chrome.storage` and handed to a client
  constructed with `dangerouslyAllowBrowser: true`, so anything that can run script in the panel
  document can read it. That is an extension origin holding a key the user pasted themselves, but
  it is a smaller boundary than a separate process would give.
- **Closing the panel ends the turn.** A consequence of the panel owning the stream rather than
  the service worker; the alternative is a worker that Chrome kills mid-turn.

## Verifying a change

`npm run verify` runs format, lint, typecheck, the test suite and the build.
`src/preview/panel.html` renders the panel against a stubbed `chrome.*`; pass
`?base=…&model=…&key=…` to point it at any OpenAI-compatible endpoint, and `?granted=0` to
reproduce the model-access screen. Every tab a run opens is recorded on `globalThis.__openedTabs`,
so a driver can assert on what the agent actually did to the browser.
