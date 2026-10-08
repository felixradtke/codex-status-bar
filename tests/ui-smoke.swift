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

// Idle icons must differ at identical dimensions; selecting each menu item must update
// the actual status button immediately, including after a working animation stops.
let styles: [StatusController.AnimStyle] = [.web, .code, .crab, .mark]
func pixels(_ image: NSImage) -> Data {
    controller.flattened(image).tiffRepresentation!
}
for system in [false, true] {
    controller.iconSystem = system
    controller.iconCache.removeAll()
    let color: NSColor? = system ? nil : controller.brand
    var idleImages: [Data] = []
    for style in styles {
        let item = NSMenuItem(); item.representedObject = style.rawValue
        controller.chooseStyle(item)
        let expected = pixels(controller.restingIcon(color: color))
        precondition(pixels(controller.statusItem.button!.image!) == expected, "Style selection did not update idle icon")
        precondition(!idleImages.contains(expected), "Two animation styles share an idle icon")
        idleImages.append(expected)
        controller.render(label: "Working", color: color, animate: true, startedAt: now)
        var moved = false
        for _ in 0..<12 {
            controller.animStep()
            moved = moved || pixels(controller.statusItem.button!.image!) != expected
        }
        precondition(moved, "Working animation is frozen on its resting image")
        controller.render(label: "", color: color, animate: false, startedAt: 0)
        while controller.markOutro { controller.animStep() }
        precondition(pixels(controller.statusItem.button!.image!) == expected, "Task completion lost selected style")
    }
}

let canvas = NSView(frame: NSRect(x: 0, y: 0, width: 520, height: 330))
canvas.wantsLayer = true; canvas.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
func label(_ text: String, x: CGFloat, y: CGFloat, size: CGFloat = 13) {
    let v = NSTextField(labelWithString: text); v.font = .systemFont(ofSize: size, weight: .medium)
    v.frame = NSRect(x: x, y: y, width: 475, height: 25); canvas.addSubview(v)
}
label("Codex Status Bar · 0.5.1", x: 22, y: 285, size: 20)
label("Actual native icons: each style stays distinct at rest", x: 22, y: 258, size: 11)
for (i, name) in ["Codex", "Terminal", "Crab", "Orbit"].enumerated() {
    label(name, x: CGFloat(143 + i * 94), y: 210, size: 12)
}
for (row, tuple) in [("Idle · Blue", false, false), ("Working · Blue", false, true),
                     ("Idle · System", true, false), ("Working · System", true, true)].enumerated() {
    let y = 166 - row * 42
    label(tuple.0, x: 22, y: CGFloat(y), size: 12)
    for (i, style) in styles.enumerated() {
        controller.animStyle = style
        let color: NSColor? = tuple.1 ? nil : controller.brand
        let icon = tuple.2 ? controller.iconImage(color: color, frame: style == .mark ? 50 : 8)
                          : controller.restingIcon(color: color)
        let view = NSImageView(frame: NSRect(x: 152 + i * 94, y: y, width: 24, height: 24))
        view.image = icon; view.imageScaling = .scaleProportionallyUpOrDown
        if tuple.1 { view.contentTintColor = .labelColor }
        canvas.addSubview(view)
    }
}
label("Synthetic idle and working states · No hooks installed", x: 22, y: 10, size: 11)
canvas.layoutSubtreeIfNeeded()
let rep = canvas.bitmapImageRepForCachingDisplay(in: canvas.bounds)!
canvas.cacheDisplay(in: canvas.bounds, to: rep)
let output = ProcessInfo.processInfo.environment["CODEX_STATUSBAR_UI_IMAGE"]!
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
print("AppKit checks passed: distinct idle styles, immediate menu selection, working/idle transitions in both colors, menu options and completion sound gating.")
