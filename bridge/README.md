# Arlo bridge

The Codex SDK is a server-side Node library and [explicitly does not support
browsers](https://developers.openai.com/codex/sdk), so the extension cannot import it. This process
is the seam between the two.

```bash
cd bridge && npm install && npm start
```

It prints a bearer token on startup; paste that into the extension's AI settings.

## What it guarantees

- **Loopback only.** Binds `127.0.0.1`, never `0.0.0.0`.
- **Token gated.** A token is minted per start and compared in constant time. Any page in the
  browser can reach a loopback port, so this is the gate that matters.
- **Origin checked.** Only `chrome-extension://` origins by default. Defence in depth — a browser
  always sends `Origin` cross-origin, so a page cannot omit it to slip through.
- **One folder per session.** Every chat gets `<workspace>/<uuid>/` and the agent is sandboxed to it
  with `sandboxMode: 'workspace-write'` and no network. It cannot read or write another session.
- **No approvals.** `approvalPolicy: 'never'` — there is no one at the other end to answer a prompt,
  so the sandbox is what constrains the agent, not a human in the loop.

## Environment

| Variable               | Default                   |
| ---------------------- | ------------------------- |
| `ARLO_BRIDGE_PORT`     | `4319`                    |
| `ARLO_BRIDGE_TOKEN`    | random per start          |
| `ARLO_WORKSPACE_ROOT`  | `~/.arlo/sessions`        |
| `ARLO_ALLOWED_ORIGINS` | any `chrome-extension://` |

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
