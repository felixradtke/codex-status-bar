# Privacy

Codex Status Bar has no analytics or developer-operated server. Its only direct network request is an approximately daily request to GitHub's public API for this repository's latest release tag. GitHub receives ordinary connection metadata; task metadata is not included.

Local status files contain task/session and turn IDs, state, tool names, model, project path, process identity, timestamps, and desktop chat titles when available. These are private metadata and stay in the user's Codex directory. New status directories use mode 0700 and files use mode 0600.

The desktop fallback reads local Codex rollout records, which can contain conversation content. It processes lifecycle/type metadata and does not copy prompts, assistant text, tool arguments, or tool outputs to its state files. Chat titles may themselves contain sensitive words and are displayed locally. No usage, billing or credentials files are read.

First launch merges this app's commands into Codex hooks.json and saves a one-time backup. It never modifies Claude's settings, Codex config.toml, hook trust, or approval policies. Hook commands are observational and emit no approval decisions. Codex still requires users to review and trust them.

Uninstallation preserves unrelated hooks and the original backup. The app installs no launch agent, network listener or persistent app-server sidecar.
