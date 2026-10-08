# Comparison and fork provenance

Compared on 8 October 2026 from local Git clones, not README descriptions alone.

- Latest Claude Status Bar: **0.4.5**, `dafb0c8`.
- Existing Codex fork: **Jas952/codex-status-bar**, `6fe6300`.
- Common ancestor: `4327080`. Claude upstream has **32 commits** after this shared base, including merge and documentation commits. This count is divergence, not 32 missing features: the Codex fork has independent changes.
- New Codex Status Bar: based directly on `dafb0c8`, retaining upstream history.

| Area | Claude 0.4.5 | Existing Jas952 fork | This adaptation |
|---|---|---|---|
| Show text | Independent on/off toggle | Older Thinking words option | Independent toggle retained |
| Orbit animation | Included | Not included | Retained |
| Other animation choices | Spark, Unicode, Clawd | Codex Cloud, Terminal Pulse | Codex terminal tile, Terminal, Crab |
| Completion sounds | Off, Every turn, 1/5/15 min+ | No completion-sound menu in inspected source | All upstream thresholds retained |
| Rendering | Cached animation frames, change-only title redraws | Independently rewritten cloud motion | Upstream caches/redraw improvements retained |
| Node upgrades | Stable runtime resolution | Installer pins process.execPath | Stable runtime wrapper, fallback for nvm/fnm |
| Multi-session display | Project, branch, timer, surface | Also chat titles and MCP details | Project, branch, timer, surface; desktop titles from local index |
| Codex integration | None | Hooks and rollout monitor | New locked hook reducer and incremental monitor |
| Interruptions | Claude-specific recovery | In inspected fallback, aborted/cancelled turns become done | Interrupted stays distinct from done; no completion chime |
| Parallel tool completion | Claude-oriented hook states | Hooks track tools; fallback clears all on a result | Hook and fallback match each result to its tool ID |
| Local monitor | Not needed for Claude integration | Scans rollout tree every 500 ms | Watcher plus incremental reads; discovery fallback each minute |
| MCP server health | None | App-server sidecar | Not included; active MCP tools still show their server label |
| Distribution | Homebrew and notarized releases | Source build | Source and local ad-hoc signed app/DMG; no cask or notarization claim |

The prior fork is not simply obsolete: it includes its own Codex Cloud artwork and MCP health interface. This adaptation prioritizes parity with the current Claude menu bar app and reliable completion tracking.

## Repository relationship

GitHub returned the already-existing `felixradtke/claude-status-bar` when asked to create another fork in that network. To preserve that repository, `felixradtke/codex-status-bar` is a **separate derived repository with the full upstream Git history**, rather than a second GitHub-network fork. Its `upstream` remote points to the original Claude repository. No changes were pushed to the existing Claude fork.

## Verification boundary

See [VALIDATION.md](VALIDATION.md) for the actual checks and remaining limitations. An existing project README claiming desktop support was not treated as proof that a locally built adaptation works.
