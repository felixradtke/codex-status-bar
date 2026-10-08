import Cocoa
let dest = CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath: dest, withIntermediateDirectories: true)
for side in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = side * scale
        let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
                                  bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        rep.size = NSSize(width: 1024, height: 1024)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        let shape = NSBezierPath(roundedRect: NSRect(x: 65, y: 65, width: 894, height: 894), xRadius: 210, yRadius: 210)
        NSGradient(starting: NSColor(srgbRed: 0.25, green: 0.49, blue: 0.97, alpha: 1),
                   ending: NSColor(srgbRed: 0.29, green: 0.22, blue: 0.76, alpha: 1))!.draw(in: shape, angle: -70)
        NSColor.white.setStroke()
        let chevron = NSBezierPath(); chevron.move(to: NSPoint(x: 265, y: 325)); chevron.line(to: NSPoint(x: 455, y: 512)); chevron.line(to: NSPoint(x: 265, y: 699))
        chevron.lineWidth = 65; chevron.lineCapStyle = .round; chevron.lineJoinStyle = .round; chevron.stroke()
        let cursor = NSBezierPath(); cursor.move(to: NSPoint(x: 560, y: 330)); cursor.line(to: NSPoint(x: 760, y: 330))
        cursor.lineWidth = 65; cursor.lineCapStyle = .round; cursor.stroke()
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(dest)/icon_\(side)x\(side)\(suffix).png"))
    }
}
