# Server Lifecycle

## Core Principle

The dashboard server is per-plan and persistent across batches. It self-terminates on idle or owner-PID death. /report is responsible for starting it once per plan, not on every invocation.

## State Directory Layout

- Root: `.model-trainer/report-server/<plan-id>/`
- `server.pid` — Node process PID
- `server.log` — captured stdout and stderr
- `server-info` — JSON with `port`, `url`, `content_dir`, `state_dir`
- `content/dashboard.json` — the spec the page consumes; overwritten per /report run

## Plan ID

Derive the plan-id from the plan filename basename without extension (the `YYYY-MM-DD-<name>` portion of the experiment plan path). Enforce one plan per dir.

## Start Sequence

- /report checks for `server.pid`. If present and the PID is live, skip start.
- If absent or stale, execute `scripts/start-server.sh --project-dir <repo-root>`. The script derives `<repo-root>/.model-trainer/report-server/<plan-id>/` internally from the active plan.
- Wait for the JSON line on stdout containing `port`, `url`, `content_dir`, `state_dir`.
- Capture `state_dir` from that JSON — it is the `<session_dir>` positional argument required by `scripts/stop-server.sh`. The two scripts are deliberately asymmetric: start resolves the path from the plan, stop takes the already-resolved path.
- Open the browser to the URL.

## Persist Sequence

- Server stays alive between /report invocations within the same plan.
- The next /report run reuses the running server: writes a new `dashboard.json`, the file watcher fires, the WS broadcast triggers page reload.

## Termination Conditions

- Owner-PID death (Claude Code session ends) — checked every 60 seconds via `process.kill(pid, 0)`.
- Idle timeout — 30 minutes of no HTTP or WebSocket activity.
- Explicit stop — `scripts/stop-server.sh` invoked.

## Failure Modes

- Random-port collision: `start-server.sh` fails to see `server-started` in the log within 5 seconds, emits an error JSON line, /report returns BLOCKED with retry hint.
- Stale `server.pid` (process died but file remained): /report detects via `process.kill(pid, 0)` failure, removes the file, starts a new server.
- ECharts vendored file missing: page renders the JSON spec as fallback text with an error banner; /report still returns DONE.
- Browser closed by the user: harmless. Server keeps running until termination conditions fire.

## Gate Functions

- BEFORE starting a server: "Is the PID file present and live? If yes, skip start."
- BEFORE writing dashboard.json: "Is the per-plan state directory present? If not, create it."
- BEFORE returning DONE: "Is the dashboard URL printed in the terminal?"
- BEFORE killing a server explicitly: "Did the user request stop, or am I assuming the plan is done?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| Starting a fresh server every batch is simpler | It loses the open browser tab and the live-update benefit. Reuse the running one. |
| I can keep the server alive after the plan finishes for the next plan | No. New plan = new state dir = new server. Per-plan isolation. |
| Stale PID files are fine, I'll just leave them | Stale PIDs cause start-skip false positives. Verify with `process.kill(pid, 0)` and clean up. |
| Random port is fine, collisions are rare | Collisions happen. The launcher detects via missing `server-started` in log. |

## Red Flags

- Starting a server when one is already running for the plan
- Sharing a server across plans
- Trusting a PID file without liveness check
- Hardcoding a port instead of using the random allocation
- Killing a healthy server before plan completion

## Bottom Line

Write and execute a script that, for the current plan-id, checks: the state dir exists, `server.pid` either points at a live process or is absent, `server-info` is valid JSON if present, and `content/dashboard.json` exists if any /report run has completed for the plan. Print `SERVER LIFECYCLE: PASS` when all checks hold or `SERVER LIFECYCLE: FAIL` with the specific failing check.
