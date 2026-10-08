# Validation — 8 October 2026

## 0.5.1 icon regression checks

- In both Blue and System modes, all four resting icons have distinct rendered pixels.
- Selecting each style updates the actual status button immediately while idle.
- Each style animates while working and returns to its own resting image on completion.
- Native icon grid rendered and visually inspected; 18 Node tests still pass.

## Passed locally

- 18 Node tests: configuration preservation and one-time backups, idempotent installation, uninstall ownership, malformed config handling, shell quoting, empty PATH handling, parallel hook writers, per-tool approval priority, steering/timer preservation, duplicate/late completion, compaction, input requests, interruption, transcript partial writes and UTF-8 boundaries, and exclusion of CLI/subagent rollouts from the desktop fallback.
- Native AppKit assertions against the actual controller: all four animation choices and five completion-sound options exist; text/timer controls exist; animation frames render; completion duration gating, duplicate suppression, interruption suppression and long-running state behavior pass.
- Native session-row and icon components rendered with synthetic task data and visually inspected. See `ui-preview.png`.
- A live read-only desktop-monitor run detected the currently running Codex task and resolved its chat title. Its private state remained outside the repository in the working directory.
- Apple Silicon build, macOS 12 deployment target; application Info.plist validation and strict code-signature verification passed.
- Application launched in isolated preview mode without installing hooks or starting the real monitor.
- DMG creation and repository whitespace checks passed.

## Boundaries

- The local computer-use service timed out, so full menu click-through testing was not completed. AppKit component rendering and programmatic menu assertions are narrower checks.
- Hook trust was not changed and the app was not installed into Applications. Hook event handling was exercised with synthetic fixtures, including concurrent real hook processes, rather than by running a paid CLI conversation.
- The live fallback was observed while the current task was working. Completion and interruption were verified with fixtures; a full live task-completion notification cycle was not observed.
- Sound gating and the bundled audio asset were checked; audible playback was not manually confirmed.
- No new CPU benchmark was performed. Rendering optimisations are inherited from upstream, not a measured performance claim for this fork.
- The supplied binary is arm64. The installed Swift toolchain lacks the x86_64 compatibility libraries needed for an Intel build; Intel is not validated.
- The app is ad-hoc signed, not Apple-notarized. There is no Homebrew cask.
- Codex transcript formats are not stable APIs. Some approval/input states require trusted hooks and cannot be reconstructed from the fallback log alone. Cloud-only sessions are outside scope.
