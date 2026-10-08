#!/bin/bash
# Local, reproducible macOS build; set SIGN_IDENTITY for your own certificate.
set -euo pipefail
cd "$(dirname "$0")"
APP="build/Codex Status Bar.app"
BIN="$APP/Contents/MacOS/CodexStatusBar"
mkdir -p build/module-cache "$APP/Contents/MacOS" "$APP/Contents/Resources"
ARCHS="${CODEX_STATUSBAR_ARCHS:-$(uname -m)}"
for arch in $ARCHS; do
  swiftc -O -module-cache-path build/module-cache -target "$arch-apple-macos12.0" Sources/*.swift -o "$BIN.$arch" -framework Cocoa
done
slices=()
for arch in $ARCHS; do slices+=("$BIN.$arch"); done
lipo -create "${slices[@]}" -output "$BIN"
rm "${slices[@]}"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>CodexStatusBar</string>
<key>CFBundleDisplayName</key><string>Codex Status Bar</string>
<key>CFBundleIdentifier</key><string>com.felixradtke.codexstatusbar</string>
<key>CFBundleExecutable</key><string>CodexStatusBar</string>
<key>CFBundleVersion</key><string>0.5.0</string>
<key>CFBundleShortVersionString</key><string>0.5.0</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>LSUIElement</key><true/>
<key>CFBundleIconFile</key><string>AppIcon</string>
</dict></plist>
PLIST
cp hooks/*.js "$APP/Contents/Resources/"
cp assets/AppIcon.icns assets/completion.mp3 "$APP/Contents/Resources/"
xattr -cr "$APP"
codesign --force --sign "${SIGN_IDENTITY:--}" "$APP"
codesign --verify --deep --strict "$APP"
echo "Built $APP"
if [[ "${1:-}" == "--dmg" ]]; then
  mkdir -p build/dmg-stage
  ditto "$APP" "build/dmg-stage/Codex Status Bar.app"
  ln -sfn /Applications build/dmg-stage/Applications
  hdiutil create -volname "Codex Status Bar" -srcfolder build/dmg-stage -ov -format UDZO build/CodexStatusBar.dmg
fi
