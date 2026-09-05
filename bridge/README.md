# Arlo bridge

The Codex SDK is a server-side Node library and [explicitly does not support
browsers](https://developers.openai.com/codex/sdk), so the extension cannot import it. This process
is the seam between the two.

```bash
cd bridge && npm install && npm start
```

There is nothing to configure and nothing to copy. Open the side panel and it connects.

## Current-tab tool

Each agent turn registers `read_current_tab` with `compact`, `detailed`, and `html` levels.
The browser captures the active tab in the Arlo panel's own window when the agent calls it.
Long responses can be continued with a page fingerprint, so changed pages cannot be mixed.
See [the tool contract and implementation notes](../docs/current-tab-tool.md).

After updating, reinstall bridge dependencies, rebuild/reload the extension and restart this
process. Click the Arlo toolbar icon on the page to provide Chrome's temporary page access.
Tool registration is automatic for Arlo's Codex child and does not change global Codex settings.

## What it guarantees

- **Loopback only.** Binds `127.0.0.1`, never `0.0.0.0`.
- **Paired to one extension.** The first extension to connect is remembered in `.arlo-client` in
  the workspace, and only that one is accepted afterwards. Delete that file to pair again.
- **Identified two ways.** An extension holding a host permission makes a _privileged_ fetch:
  Chrome bypasses CORS and sends **no `Origin` header at all** — confirmed by the `first contact`
  line this server prints. So the panel also sends its id in `X-Arlo-Client`, and either signal
  identifies it.
- **Pages cannot use the second route.** A custom header on a cross-origin fetch forces a preflight,
  and a page always carries an `Origin` the bridge refuses — so forging the id buys nothing.

A token is _not_ required. `ARLO_BRIDGE_TOKEN` still works if you want one — it is checked in
constant time on top of the pairing — but it defends against local processes, which is a position
already lost: anything running code on this machine can invoke `codex` directly.

- **One folder per session.** Every chat gets `<workspace>/<uuid>/` and the agent is sandboxed to it
  with `sandboxMode: 'workspace-write'` and no network. It cannot read or write another session.
- **No approvals.** `approvalPolicy: 'never'` — there is no one at the other end to answer a prompt,
  so the sandbox is what constrains the agent, not a human in the loop.

## Environment

| Variable               | Default                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `ARLO_BRIDGE_PORT`     | `4319`                                                       |
| `ARLO_BRIDGE_TOKEN`    | random per start                                             |
| `ARLO_WORKSPACE_ROOT`  | `~/.arlo/sessions`                                           |
| `ARLO_ALLOWED_ORIGINS` | none; _adds_ origins, and never removes the paired extension |

## Routes

| Route                                        | Purpose                                                         |
| -------------------------------------------- | --------------------------------------------------------------- |
| `GET /health`                                | liveness and workspace root; the only unauthenticated route     |
| `POST /sessions`                             | create a session folder, returns `{ id, dir }`                  |
| `POST /sessions/:id/messages`                | run one turn, streaming Codex events as SSE                     |
| `POST /sessions/:id/page-results/:requestId` | answer a pending browser read for this chat                     |
| `POST /mcp/:turnId`                          | Codex-only MCP endpoint, authenticated by a per-turn capability |

The API key is passed to Codex by _name_ (`env_key`), so it travels in the child environment and is
never written to a config file. `wire_api` is chosen from the profile's contract — `responses` or
`chat`. Codex has no Anthropic wire protocol, so an Anthropic profile is rejected with a clear error
rather than failing at the endpoint.
