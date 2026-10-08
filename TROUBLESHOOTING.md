# Troubleshooting

- **No activity:** launch Codex Status Bar once, verify Node is available, review the definitions in Codex `/hooks`, and start a new turn. Hook trust is not automatic. For Desktop, allow a new tool/lifecycle event so the monitor can observe the task.
- **No sound:** Completion Sound defaults to Off. Select Every turn or a duration threshold. Interrupted/cancelled turns do not play completion sounds.
- **Approval or input not shown:** those states require corresponding hook/tool events. The desktop fallback cannot reconstruct a prompt that is absent from the local rollout.
- **No icon with no active session:** the app normally exits when Codex Desktop is closed and no CLI session remains. The next trusted SessionStart hook launches it again.
- **Quit keeps the app closed:** Quit writes a suppression marker. A new SessionStart or manual launch clears it.
- **A long task seems stuck:** there is no silence-based completion timeout. Wait for an actual lifecycle event. Force-closed processes are removed; an abruptly abandoned desktop rollout without a close signal can remain until the desktop app closes. The monitor never treats old incomplete logs as proof of current activity on launch.
- **Desktop task missing:** cloud-only tasks or sessions without local rollouts cannot be tracked. Rollout formats can change in new Codex releases.
- **Build fails for Intel:** recent toolchains may omit x86_64 Swift back-deployment libraries. Build natively, or use a toolchain with both architectures. The supplied initial build is Apple Silicon only.
- **macOS distribution warning:** local builds are ad-hoc signed and are not Apple-notarized. Building from source is supported. No updater automatically installs software.

The app's local runtime is `${CODEX_HOME:-~/.codex}/codex-status-bar/`; it is intentionally separate from other Codex status-bar projects.
