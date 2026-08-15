# Agent-safe preview lifecycle

## Context

HyperFrames Studio is commonly launched by an agent through `npx hyperframes preview`. A foreground child process remains owned by the invoking shell or tool session, so the preview listener can disappear when that session is reclaimed even though the user never presses Ctrl+C or closes the browser. The next browser reload then reports `ERR_CONNECTION_TIMED_OUT`.

PR #3280 already adds an explicit persistent lifecycle (`--background`, `--status`, `--stop`, `--list`, and `--kill-all`). The remaining problem is discoverability and default behavior: an agent that invokes the bare command can still choose the fragile lifecycle accidentally, and the command prints the server root rather than the exact Studio project route.

## Goals

- Make the safe persistent lifecycle the default for non-interactive and agent invocations.
- Preserve the familiar foreground process, logs, and Ctrl+C behavior for a human terminal.
- Give agents an exact project URL and structured lifecycle state without parsing prose.
- Keep lifecycle operations idempotent and ownership-safe.
- Maintain explicit overrides for scripts whose desired lifecycle differs from the detected environment.

## Non-goals

- Changing Studio rendering, project discovery, or media serving.
- Keeping arbitrary foreground processes alive after their owning shell exits.
- Managing preview processes that HyperFrames cannot prove it owns.
- Treating an HTTP-ready Studio server as proof that every composition rendered successfully.

## Launch-mode contract

The CLI resolves launch mode in this order while preserving the existing explicit-mode precedence:

1. `--background` selects the managed persistent lifecycle.
2. Existing explicit development and locally installed Studio modes retain their current priority and behavior.
3. `--foreground` disables automatic persistence and selects the foreground lifecycle appropriate to the project.
4. Otherwise, an interactive TTY selects the existing foreground lifecycle appropriate to the project.
5. Otherwise, a non-interactive invocation selects managed persistent mode.

`--background` and `--foreground` are mutually exclusive and fail before starting a process when supplied together.

TTY detection is an input to a small pure launch-mode resolver. Production passes `Boolean(process.stdin.isTTY && process.stdout.isTTY)`. Tests inject both states directly; they do not depend on the test runner's terminal. `--foreground` is a lifecycle override rather than a new server implementation: after it suppresses automatic backgrounding, the existing dev/local/embedded resolver still chooses the foreground server.

This preserves human behavior while making the agent path safe without requiring every skill or prompt to remember a flag.

## Human output

Every successful foreground start, background start, or background reuse prints the exact Studio deep link produced by the existing `studioDeepLink()` policy. The root server URL may remain as secondary diagnostic information, but it is not the primary handoff URL.

Background output also names:

- whether the session was started or reused;
- project directory and project name;
- PID and loopback port;
- log path;
- `preview --status` and `preview --stop` follow-up commands.

`preview --status` prints the same deep link and lifecycle fields. It reports no session distinctly from a stale session that was found and cleaned.

## Machine-readable output

`--json` is extended from selection/context queries to lifecycle commands. JSON mode writes one JSON document to stdout and sends incidental notices to stderr, preserving the CLI's existing machine-output convention.

The lifecycle envelope is versioned:

```ts
type PreviewLifecycleResult = {
  schemaVersion: 1;
  operation: "start" | "status" | "stop" | "list" | "kill-all";
  ok: boolean;
  result:
    | {
        state: "started" | "reused" | "running" | "stopped";
        mode: "background" | "foreground";
        projectName: string;
        projectDir: string;
        host: "127.0.0.1";
        port: number;
        pid: number | null;
        serverUrl: string;
        studioUrl: string;
        ready: boolean;
        logPath?: string;
      }
    | { state: "not-running"; projectDir?: string }
    | { state: "listed"; sessions: PreviewSessionSummary[] }
    | { state: "killed-all"; stopped: number };
};
```

Failure JSON uses the existing CLI error-envelope convention and stable error codes. A foreground start only emits its successful JSON result after the listener becomes reachable; the command then remains attached until terminated.

## Session ownership and reuse

The existing persistent-session record remains the source of truth. A session is reusable only when all of the following hold:

- the record belongs to the same canonical project directory;
- the recorded process is alive;
- the HyperFrames server scan finds a reachable listener that identifies the same canonical project directory;
- the live server PID, or the recorded wrapper PID when the server omits one, is valid.

An unhealthy or stale record is cleaned before a new managed process starts. `--force-new` bypasses reuse without weakening ownership checks. `--stop` and `--kill-all` only signal processes after a reachable HyperFrames listener proves the canonical project identity; a record alone is never authority to kill a PID. Ambiguous processes are reported rather than killed.

The primary Studio URL is derived at response time from the session port and current project state, so an old record never freezes a stale route choice.

## Readiness semantics

`ready: true` means the owned preview server is reachable on the expected IPv4 loopback endpoint and can serve the Studio shell. It does not claim composition-level success. Composition errors remain visible through Studio, lint, context, and browser diagnostics.

Managed start retains the bounded readiness wait. If readiness times out, the CLI stops and reaps the process it just created, removes its record, reports the log path, and exits non-zero. It never leaves an untracked child behind.

## Skill and generated-project guidance

Skills continue to recommend `npx hyperframes preview --background` for an explicit handoff, because explicit intent remains useful and works with older CLI versions. Generated project guidance also documents `--status` and `--stop`.

The new non-interactive default is a safety net, not a reason to remove explicit guidance. Tests pin the source skill, mirrored skill artifacts, and generated `AGENTS.md` / `CLAUDE.md` templates.

## Verification

Unit and integration coverage must include:

- TTY selects foreground; non-TTY selects background;
- explicit `--background` and `--foreground` override detection;
- conflicting flags fail without spawning;
- identical project invocation reuses a healthy managed session;
- `--force-new` creates a distinct managed session;
- start, reuse, status, list, stop, and kill-all JSON schemas;
- stdout remains valid JSON in JSON mode;
- human start and status output use the exact Studio deep link;
- stale record cleanup and ownership-mismatch refusal;
- readiness timeout reaps the new process and removes its record;
- stop reaps both the preview process and any recorded wrapper;
- generated and mirrored agent instructions remain consistent.

End-to-end verification uses the packed CLI through the real `npx hyperframes preview` entry point:

1. Human/PTY foreground start stays attached and stops on Ctrl+C.
2. Non-TTY bare start returns after creating a managed preview.
3. The printed Studio deep link loads the intended project.
4. The preview survives launcher exit and repeated hard browser reloads.
5. `--status --json` returns the live identity and route.
6. `--stop` removes the listener and session record.

An independent agent-acceptance pass follows the automated suite. Subagents receive a clean project and only the installed HyperFrames skill plus public CLI help; they are not told the implementation or the expected internal process model. They must independently:

1. discover how to launch and hand off Studio;
2. obtain the exact project deep link;
3. re-run the launch and observe safe session reuse;
4. confirm repeated hard reloads survive after the launching tool call returns;
5. inspect lifecycle state in both human and JSON forms;
6. stop the preview and confirm the listener and recorded identity are gone.

Failures in discovery, ambiguous output, accidental duplicate servers, or leaked processes are product defects even when lower-level tests pass.

The user-provided project used to reproduce the timeout remains private and is not committed as a fixture. A synthetic project covers the same lifecycle contract in automated tests.

## Compatibility and rollout

Interactive users see no default lifecycle change. Non-interactive scripts that relied on the bare command blocking must add `--foreground`; this is an intentional correction because the old implicit lifecycle was unsafe for the primary agent use case. The release note and CLI help call out the override.

The change ships in PR #3280 with the existing audio and persistent-preview fixes so the reported Studio failures are addressed and verified together. CI and review feedback are monitored to green; merge remains a human decision.
