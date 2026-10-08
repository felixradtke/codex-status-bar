// Runs the actual AppKit controller/components against isolated synthetic state.
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
app.appearance = NSAppearance(named: .aqua)
let controller = StatusController()
let menu = NSMenu()
controller.menuNeedsUpdate(menu)
for title in ["Animation", "Color", "Completion Sound", "Version \(controller.currentVersion)", "Quit"] {
    precondition(menu.items.contains { $0.title == title }, "Missing menu item: \(title)")
}
let animation = menu.items.first { $0.title == "Animation" }!.submenu!
precondition(animation.items.map(\.title) == ["Codex", "Terminal", "Crab", "Orbit"])
let sound = menu.items.first { $0.title == "Completion Sound" }!.submenu!
precondition(sound.items.map(\.title) == ["Off", "Every turn", "1 min+", "5 min+", "15 min+"])
let toggles = menu.items.flatMap { $0.view?.subviews.compactMap { ($0 as? NSTextField)?.stringValue } ?? [] }
precondition(toggles.contains("Show text") && toggles.contains("Show timer"))
let now = Date().timeIntervalSince1970
var task = StatusController.Session(json: ["state": "done", "completedAt": now + 1, "completedDuration": 75.0], id: "completion-test")
controller.soundThreshold = 60
precondition(controller.completionEdge(task, now: now + 1))
controller.prevState[task.id] = "done"
precondition(!controller.completionEdge(task, now: now + 2), "Duplicate completion sound")
controller.prevState[task.id] = "tool"; task.state = "interrupted"
precondition(!controller.completionEdge(task, now: now + 2), "Interrupt must not chime")
task.state = "thinking"; task.ts = now - 99999
precondition(controller.effectiveState(task, now: now) == "thinking", "Silence must not finish a task")
controller.showLabel = false
precondition(controller.statusText(task, eff: "thinking").isEmpty)
controller.showLabel = true

let canvas = NSView(frame: NSRect(x: 0, y: 0, width: 520, height: 310))
canvas.wantsLayer = true; canvas.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
func label(_ text: String, x: CGFloat, y: CGFloat, size: CGFloat = 13) {
    let v = NSTextField(labelWithString: text); v.font = .systemFont(ofSize: size, weight: .medium)
    v.frame = NSRect(x: x, y: y, width: 475, height: 25); canvas.addSubview(v)
}
label("Codex Status Bar · 0.5.0", x: 22, y: 268, size: 20)
label("Native component preview — synthetic task data", x: 22, y: 240, size: 11)
for (i, style) in [StatusController.AnimStyle.web, .code, .crab, .mark].enumerated() {
    controller.animStyle = style
    for frame in [0, 4, 12] { precondition(controller.iconImage(color: controller.brand, frame: frame).size.width > 0) }
    let image = NSImageView(frame: NSRect(x: 28 + i * 125, y: 202, width: 24, height: 24))
    image.image = controller.iconImage(color: controller.brand, frame: style == .mark ? 20 : 4)
    image.imageScaling = .scaleProportionallyUpOrDown; canvas.addSubview(image)
    label(["Codex", "Terminal", "Crab", "Orbit"][i], x: CGFloat(58 + i * 125), y: 200, size: 11)
}
for (i, tuple) in [("Coding task", "tool", "Running command"), ("Figure export", "permission", "Awaiting permission"), ("Literature review", "done", "Done")].enumerated() {
    let session = StatusController.Session(json: ["state": tuple.1, "label": tuple.2, "chatTitle": tuple.0, "entrypoint": "codex-app", "startedAt": now - 75, "ts": now], id: "preview-\(i)")
    let row = SessionRowView(id: session.id, width: 475)
    row.frame.origin = NSPoint(x: 18, y: 155 - i * 36)
    controller.configureSessionRow(row, session, eff: controller.effectiveState(session, now: now)); canvas.addSubview(row)
}
label("Text and timer toggles · Completion sound thresholds", x: 22, y: 20, size: 12)
canvas.layoutSubtreeIfNeeded()
let rep = canvas.bitmapImageRepForCachingDisplay(in: canvas.bounds)!
canvas.cacheDisplay(in: canvas.bounds, to: rep)
let output = ProcessInfo.processInfo.environment["CODEX_STATUSBAR_UI_IMAGE"]!
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
print("AppKit checks passed: menu options, animation rendering, completion sound gating, duplicate/interrupt suppression, long-running state, text toggle.")
