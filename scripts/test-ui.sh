#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/ui-smoke/state
python3 - <<'PY'
from pathlib import Path
source = Path('Sources/main.swift').read_text().split('let app = NSApplication.shared')[0]
Path('build/ui-smoke/main.swift').write_text(source + Path('tests/ui-smoke.swift').read_text())
PY
swiftc -module-cache-path build/module-cache Sources/CrabFrames.swift Sources/CrabRender.swift Sources/WorkingMarkFrames.swift build/ui-smoke/main.swift -framework Cocoa -o build/ui-smoke/check
CODEX_STATUSBAR_PREVIEW=1 CODEX_STATUSBAR_ROOT="$PWD/build/ui-smoke/state" CODEX_STATUSBAR_UI_IMAGE="$PWD/build/ui-smoke/preview.png" build/ui-smoke/check
