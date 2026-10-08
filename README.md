# Codex Status Bar

A small native macOS menu bar companion for **Codex Desktop and Codex CLI**. See which tasks are working, waiting for approval, asking for input, or finished, without switching windows.

Derived directly from **Claude Status Bar 0.4.5**, upstream commit [`dafb0c8`](https://github.com/m1ckc3s/claude-status-bar/commit/dafb0c8), with its current interface and rendering improvements. See [the comparison](docs/COMPARISON.md) for what changed from the earlier Codex fork.

## Features

- Multiple sessions with project/branch, desktop chat titles when available, and APP/CLI badges.
- Approval and input requests take precedence over working sessions.
- Independent **Show text** and **Show timer** toggles.
- **Codex**, **Terminal**, **Crab**, and **Orbit** animation choices; blue or adaptive System color.
- **Completion Sound**: Off, Every turn, 1 min+, 5 min+, or 15 min+. Off by default.
- Explicit completion, interruption and compaction handling. A task is never declared complete merely because it went quiet.
- Cached animation frames, change-only text redraws, mtime-based state reads, and desktop lifecycle notifications retained from upstream.
- Separate application identity and files: it can run beside Claude Status Bar.

## Install

Requires macOS 12 or later, Node.js 18+, and Codex Desktop or Codex CLI.

1. Open the supplied `CodexStatusBar.dmg` and drag **Codex Status Bar** into Applications.
2. Launch it once. It installs only its own entries in your Codex `hooks.json`, backing up that file first.
3. In Codex, review and trust the new definitions through `/hooks`, then start a new task. Installing a hook does not grant it trust.
4. Select **Completion Sound → Every turn** if you want a chime whenever a task finishes.

The supplied development build is ad-hoc signed, **not Apple-notarized**. The repository does not currently have a Homebrew cask. Download builds only from this repository or build locally.

On desktop, a read-only local monitor also follows Codex rollout lifecycle events when hooks are unavailable. Already-running tasks appear on their next observable activity. Hooks provide the most accurate approval/input indications. The monitor cannot infer an approval prompt that Codex does not record.

## Build and test

```sh
node --test tests/*.test.js
./build.sh             # build/Codex Status Bar.app, native architecture
./build.sh --dmg       # build/CodexStatusBar.dmg
```

The default build targets this Mac's architecture and macOS 12. To build a universal binary, use `CODEX_STATUSBAR_ARCHS="arm64 x86_64" ./build.sh` with a toolchain containing both architectures' Swift compatibility libraries. The initial build was tested on Apple Silicon; Intel is not validated.

Set `SIGN_IDENTITY` to your own Developer ID certificate if signing for distribution. Notarization is a separate release step; an ad-hoc signature is not notarization.

For isolated UI testing, set `CODEX_STATUSBAR_PREVIEW=1` and `CODEX_STATUSBAR_ROOT=/absolute/path/to/fixture` when launching the executable. Preview mode skips hook installation, monitoring, update checks and automatic exit. Runtime files go only into the fixture.

## How it works

Codex hooks receive lifecycle events and atomically update one file per task under `${CODEX_HOME:-~/.codex}/codex-status-bar/state.d/`. Concurrent writers are serialized, and tool calls are tracked individually. Late results from a previous turn cannot complete a newer turn. The app polls the small state files, not the full transcripts.

The desktop monitor reads local rollout records incrementally and preserves partially written lines. It uses the session index for chat titles, ignores child-agent rollouts as separate tasks, and gives hooks priority within a turn. It runs only while the app is alive. Codex's transcript format is not a stable public API, so fallback compatibility may need updating with future Codex versions.

Clicking a desktop row opens its `codex://threads/…` link. CLI rows raise the terminal application; selecting an exact terminal tab is not implemented. Cloud-only tasks without local rollouts/hooks are not tracked.

## Uninstall

```sh
node "/Applications/Codex Status Bar.app/Contents/Resources/uninstall.js"
```

Then quit Codex Status Bar and remove its app bundle. The uninstaller removes only commands owned by this app; it keeps unrelated hooks and the backup. You may delete its `codex-status-bar` runtime folder afterward.

## Attribution

Based on [m1ckc3s/claude-status-bar](https://github.com/m1ckc3s/claude-status-bar). Its Git history, MIT license, acknowledgements, Orbit/Crab animation assets, and completion sound are retained. The Codex lifecycle adapter, desktop monitor and terminal-mark icon are specific to this fork. [Jas952/codex-status-bar](https://github.com/Jas952/codex-status-bar) was inspected for comparison; this implementation starts from the current Claude upstream instead.

This is an unofficial community project, not affiliated with or endorsed by OpenAI or Anthropic. The MIT license applies to source code and does not grant rights to their trademarks.
