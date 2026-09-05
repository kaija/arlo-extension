# Current-tab reading for the Arlo Codex agent

Arlo registers one read-only MCP tool, `read_current_tab`, whenever its bridge starts or resumes
an agent turn. The agent chooses the detail level for the task. Registration is passed through
the Codex SDK configuration for that child process; it does not change desktop or CLI settings.

The panel and bridge exchange a `capabilities.pageReader: 1` handshake before starting a turn.
An old bridge produces a restart prompt in the panel; a current bridge rejects an old panel with
a reload message before invoking Codex. The page MCP server is required, so a registration
failure cannot silently start an agent without the page tool. Current-page instructions explicitly
select Arlo's reader because general browser tools may point to another browser or window.

## Reading levels

| `level`             | Content                                                                                                                                     | Typical use                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `compact` (default) | Markdown headings, paragraphs, emphasis, lists, links, code, image alt text and flattened table text. No HTML tags.                         | Reading, summaries, finding information.  |
| `detailed`          | Markdown plus HTML tables, form controls, labels, custom roles and necessary attributes; images include their URLs.                         | Understanding tables, forms and controls. |
| `html`              | The current DOM serialized as HTML, including the doctype and head when reading the whole page. Includes scripts, styles and hidden markup. | Inspecting exact markup and selectors.    |

The two text levels use [Turndown](https://github.com/mixmark-io/turndown). They omit scripts,
styles, templates, hidden elements and non-text canvas/SVG content. Detailed mode preserves
`table`, table sections/rows/cells, `button`, `input`, `select`, `option`, `optgroup`, `textarea`,
`label`, `details`, `summary`, and elements with `role` or `contenteditable`. Relevant attributes
include `id`, `name`, `type`, `value`, `role`, `aria-*`, labels, placeholders, selection/disabled
state and table spans. Event handlers, style, class and unrelated attributes are removed.
Detailed mode reflects current input values, selections and checkbox state; password values
are redacted and hidden inputs are omitted. Relative links and images resolve against the
document's base URL. None of these transformations modify the webpage.

`html` is serialized **live DOM**, including JavaScript changes. It is not the original HTTP
response, and it preserves DOM attributes rather than expanding runtime properties such as a
text input's current `.value`. It is not sanitized or rendered in the Arlo UI.

## Tool contract

```json
{ "level": "compact" }
```

Optional arguments:

- `selector`: a CSS selector; reads the first matching element in the main document.
- `maxChars`: 1–24,000 UTF-16 characters per response, default 12,000.
- `offset`: starting character offset, default 0.
- `snapshotId`: the fingerprint from a previous read; required when `offset` is positive.

Success returns `ok: true` and `page`, containing the tab ID, actual URL, title, capture time,
level, scope, content, total character count, offset, next offset and snapshot fingerprint.
`nextOffset: null` means there is no remaining content. Otherwise, call again with `nextOffset`
as `offset`, the returned `snapshotId`, and the same `level` and `selector`.

Every call resolves the active tab afresh in the browser window containing the Arlo panel,
including continuation calls. The fingerprint checks the tab, URL, level, selector and converted
content. A change returns `PAGE_CHANGED`; the agent should restart at offset 0 without a
fingerprint. This prevents joining chunks from different pages. Nothing is read from other
windows or from an agent-supplied tab ID.

Errors return `ok: false` with a code and message. They cover missing/unsupported tabs, missing
Chrome access, invalid arguments/selectors, no selector match, changed pages, disconnected panels
and timeouts. Captures above 5 million HTML characters return `PAGE_TOO_LARGE` and ask the agent
to narrow the read with `selector`, rather than silently discarding content.

## Browser access and scope

The reader uses Chrome's `scripting` permission with the existing temporary `activeTab` grant.
Click the Arlo toolbar icon on the page to grant access. After switching tabs or navigating to a
different origin, Chrome may require another toolbar click. An agent call cannot grant access.
No all-sites permission is added. Chrome internal pages, extension pages and local files are
unsupported.

The service worker disables `openPanelOnActionClick` (including the setting persisted by
older builds) and opens the window's panel directly inside `chrome.action.onClicked`.
Chrome grants `activeTab` before dispatching that event. Its automatic side-panel toggle
instead returns before granting access; see Chromium's
[`ExtensionActionRunner::RunAction`](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/extension_action_runner.cc).
Using the automatic toggle causes a toolbar click to open Arlo without granting page access.

Injection failures retain Chrome's original error and the target tab/window IDs. Only host
access failures return `PAGE_ACCESS_REQUIRED`; unavailable scripting returns
`READER_UNAVAILABLE`, protected pages return `UNSUPPORTED_PAGE`, and other execution errors
return `READ_FAILED`. This avoids treating every injection failure as a missing user gesture.

Reads cover the main document, including content outside the viewport that is already in its
DOM. They do not scroll, fetch lazy content, enter iframe documents, traverse shadow roots or
operate page controls.

## Connection lifecycle

```text
Codex → per-turn MCP endpoint → page.read event in the existing chat stream
      → Arlo panel → Chrome isolated-world capture → Turndown (text modes)
      → authenticated page-results response → MCP tool result → Codex
```

The MCP endpoint uses an ephemeral per-turn token passed through the child environment. The
extension reply route uses the bridge's existing pairing and optional token. Requests are
correlated to their session and request ID, with at most eight pending reads and a 25-second
timeout. Ending the turn or closing/resetting the panel cancels pending reads and invalidates the
MCP capability. Returned page text is explicitly described to the agent as untrusted task data.

## Build and verify

```sh
npm ci
npm ci --prefix bridge
npm run typecheck
npm run typecheck --prefix bridge
npm test
npm run build
```

Reload the unpacked extension from `dist/` in Chrome, restart the Arlo bridge, open a regular
webpage with the Arlo toolbar icon, then ask Arlo to summarize the current page or inspect a form.
The agent receives mode-selection guidance with the tool registration.

Tests cover the toolbar grant flow using Chromium's action-dispatch contract, conversion
fidelity, untouched DOM, live form state, page/window selection,
continuation, permission failures, request isolation and lifecycle, streamed browser replies,
and discovery/tool calls through actual MCP transports. HTTP tests need permission to bind a
temporary loopback port. No live model request is required for the automated tests.

Registration follows the official [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
and the installed Codex SDK's configuration overrides. Browser capture uses
[`chrome.scripting.executeScript`](https://developer.chrome.com/docs/extensions/reference/api/scripting).
