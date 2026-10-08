# Contributing

Keep the app small and focused on Codex task status on macOS. Preserve the upstream menu behavior when adapting the Codex integration.

Run `node --test tests/*.test.js` and `./build.sh` before submitting a change. Test new state transitions through both hooks and monitor fixtures. In particular, interruptions, stale events, partial writes, concurrent tools, and approvals must not produce false completion.

Use synthetic data in tests and screenshots. Never commit local state files, rollout logs, configuration, chat titles, or credentials. Preserve MIT attribution for upstream code and assets. Do not claim notarization, Intel compatibility, CPU measurements or live hook behavior without verifying them.
