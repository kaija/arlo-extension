# Arlo bridge

The Codex SDK is a server-side Node library and [explicitly does not support
browsers](https://developers.openai.com/codex/sdk), so the extension cannot import it. This process
is the seam between the two.

```bash
cd bridge && npm install && npm start
```

There is nothing to configure and nothing to copy. Open the side panel and it connects.

## What it guarantees

- **Loopback only.** Binds `127.0.0.1`, never `0.0.0.0`.
- **Paired to one extension.** The first `chrome-extension://` origin to connect is remembered in
  `.arlo-client` in the workspace, and only that one is accepted afterwards. Chrome sets `Origin`
  on an extension's cross-origin fetch and a page cannot forge it, so the origin is trustworthy
  here. Delete that file to pair with a different extension.
- **No Origin, no entry.** A browser always sends one cross-origin, so a request without it is not
  the panel. This is what keeps a local script out.

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

| Route                         | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `GET /health`                 | liveness and workspace root; the only unauthenticated route |
| `POST /sessions`              | create a session folder, returns `{ id, dir }`              |
| `POST /sessions/:id/messages` | run one turn, streaming Codex events as SSE                 |

The API key is passed to Codex by _name_ (`env_key`), so it travels in the child environment and is
never written to a config file. `wire_api` is chosen from the profile's contract — `responses` or
`chat`. Codex has no Anthropic wire protocol, so an Anthropic profile is rejected with a clear error
rather than failing at the endpoint.
