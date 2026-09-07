# Parked

Everything Arlo could do before it became a chat client for the Codex agent, kept whole rather than
deleted so a feature can be brought back with its history and its design intact.

Nothing in here is built, linted, typechecked or tested — `parked/` is excluded in `tsconfig.json`,
`eslint.config.js` and `.prettierignore`, and the test runner only looks in `tests/`. So these files
are a snapshot: they compiled against the code as it stood at the parking commit, not against
whatever `src/` looks like now.

| Folder | What it was |
| --- | --- |
| `background/` | the planner, the run controller, and the content-script registration |
| `content-script/` | page actions and the on-page target highlight |
| `core/` | the run state machine, the gate policy, the run vocabulary, site suggestions |
| `sidepanel/` | the plan, run, step, gate, hand-off and outcome cards, and their presentation logic |
| `shared/` | the content-script half of the message protocol |
| `preview/` | the interactive fidelity board — every plan/run/gate state at the real 400 x 760 |
| `tests/` | the tests that covered all of the above |
| `vite.content.config.ts` | the second build pass that produced `content.js` |

Two files were split rather than moved whole, and say so in their own headers:
`background/llm-planning.ts` came out of `src/background/llm-client.ts`, and
`tests/llm-client-planning.test.ts` out of its test. Both need helpers that stayed behind.

## Drift since parking

`src/design-system/icons.tsx` no longer carries the icons only these components used, because
nothing shipping imported them: `StopIcon` (`sidepanel/components/Outcomes.tsx`), `HandIcon`
(`NeedsHelpCard.tsx`) and `CheckIcon` (`Onboarding.tsx`). Restore them from history alongside the
components, or point those imports at icons that are still there.

## Restoring

`git mv` the files back, undo the tooling exclusions above, and re-add the removed permissions in
`src/manifest.config.ts` (`scripting`, `tabs`, and the `<all_urls>` optional host permission). The
run vocabulary in `core/types.ts` and the fields dropped from `Settings` — `pausedEverywhere`,
`blockedDomains`, `gatedActions`, `historyRetentionDays` — have to come back with it.

The preview board renders components from `parked/sidepanel/`, so it will not run until those are
back in `src/`.
