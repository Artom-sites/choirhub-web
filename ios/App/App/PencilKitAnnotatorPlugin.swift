import Foundation
import Capacitor
import UIKit
import PencilKit

// MARK: - Canvas that passes finger touches through to views underneath

/// Only captures Apple Pencil touches for drawing.
/// Finger touches (scroll, pinch-to-zoom) fall through to the WKWebView below.
class PassthroughCanvasView: PKCanvasView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        // Check if any of the current touches are from Apple Pencil
        if let touches = event?.allTouches {
            for touch in touches {
                if touch.type == .pencil || touch.type == .stylus {
                    return super.point(inside: point, with: event)
                }
            }
        }
        // Finger touches — pass through to web view underneath
        return false
    }
}

// MARK: - Plugin

/// Simple PencilKit overlay plugin.
/// startAnnotating: adds a transparent PKCanvasView over the web view + shows tool picker.
/// stopAnnotating:  saves the drawing, hides tool picker, makes canvas read-only (drawing stays visible).
@objc(PencilKitAnnotatorPlugin)
public class PencilKitAnnotatorPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PencilKitAnnotatorPlugin"
    public let jsName = "PencilKitAnnotator"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startAnnotating", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAnnotating", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCanvas", returnType: CAPPluginReturnPromise),
    ]

    private var canvasView: PKCanvasView?
    private var toolPicker: PKToolPicker?
    private var currentSongId: String?
    private var currentUserUid: String?

    // MARK: - Start Annotating

    @objc func startAnnotating(_ call: CAPPluginCall) {
        guard let songId = call.getString("songId"),
              let userUid = call.getString("userUid") else {
            call.reject("Missing songId or userUid")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let webView = self.bridge?.webView else {
                call.reject("No web view available")
                return
            }

            // If canvas already exists for this song, just re-enable it
            if let canvas = self.canvasView,
               self.currentSongId == songId,
               self.currentUserUid == userUid {
                canvas.isUserInteractionEnabled = true
                let picker = PKToolPicker()
                picker.setVisible(true, forFirstResponder: canvas)
                picker.addObserver(canvas)
                canvas.becomeFirstResponder()
                self.toolPicker = picker
                print("[PencilKit] Re-enabled canvas for song \(songId)")
                call.resolve()
                return
            }

            // Different song or no canvas — create fresh
            self.removeCanvas()

            self.currentSongId = songId
            self.currentUserUid = userUid

            // Create transparent passthrough canvas over the web view
            let canvas = PassthroughCanvasView()
            canvas.backgroundColor = .clear
            canvas.isOpaque = false
            canvas.drawingPolicy = .pencilOnly
            canvas.isScrollEnabled = false
            canvas.translatesAutoresizingMaskIntoConstraints = false

            // Offset from top so the header/nav buttons remain tappable
            let topOffset = CGFloat(call.getFloat("topOffset") ?? 0)

            webView.superview?.addSubview(canvas)
            NSLayoutConstraint.activate([
                canvas.topAnchor.constraint(equalTo: webView.topAnchor, constant: topOffset),
                canvas.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
                canvas.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
                canvas.bottomAnchor.constraint(equalTo: webView.bottomAnchor),
            ])

            // Load previously saved drawing
            self.loadDrawing(onto: canvas, songId: songId, userUid: userUid)

            // Show PencilKit tool picker
            let picker = PKToolPicker()
            picker.setVisible(true, forFirstResponder: canvas)
            picker.addObserver(canvas)
            canvas.becomeFirstResponder()

            self.canvasView = canvas
            self.toolPicker = picker

            print("[PencilKit] Started annotating for song \(songId)")
            call.resolve()
        }
    }

    // MARK: - Stop Annotating (keep canvas visible, just disable interaction)

    @objc func stopAnnotating(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve()
                return
            }

            // Save current drawing
            if let canvas = self.canvasView,
               let songId = self.currentSongId,
               let userUid = self.currentUserUid {
                self.saveDrawing(from: canvas, songId: songId, userUid: userUid)
            }

            // Hide tool picker but keep canvas visible (read-only)
            if let canvas = self.canvasView {
                self.toolPicker?.setVisible(false, forFirstResponder: canvas)
                self.toolPicker?.removeObserver(canvas)
                canvas.resignFirstResponder()
                canvas.isUserInteractionEnabled = false  // Read-only: drawing stays visible, touches pass through
            }
            self.toolPicker = nil

            print("[PencilKit] Stopped annotating (drawing remains visible)")
            call.resolve()
        }
    }

    // MARK: - Clear canvas (called when leaving the page)

    @objc func clearCanvas(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.removeCanvas()
            print("[PencilKit] Canvas removed (page exit)")
            call.resolve()
        }
    }

    // MARK: - Full cleanup (remove canvas entirely)

    private func removeCanvas() {
        if let canvas = canvasView {
            toolPicker?.setVisible(false, forFirstResponder: canvas)
            toolPicker?.removeObserver(canvas)
            canvas.resignFirstResponder()
            canvas.removeFromSuperview()
        }
        canvasView = nil
        toolPicker = nil
    }

    // MARK: - Drawing persistence

    private func annotationFileURL(songId: String, userUid: String) -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs
            .appendingPathComponent("annotations", isDirectory: true)
            .appendingPathComponent("annotation_\(songId)_\(userUid).pkdrawing")
    }

    private func loadDrawing(onto canvas: PKCanvasView, songId: String, userUid: String) {
        let url = annotationFileURL(songId: songId, userUid: userUid)
        guard FileManager.default.fileExists(atPath: url.path) else {
            print("[PencilKit] No saved drawing found")
            return
        }
        do {
            let data = try Data(contentsOf: url)
            let drawing = try PKDrawing(data: data)
            canvas.drawing = drawing
            print("[PencilKit] Loaded drawing (\(data.count) bytes)")
        } catch {
            print("[PencilKit] Corrupted drawing file, removing: \(error)")
            try? FileManager.default.removeItem(at: url)
        }
    }

    private func saveDrawing(from canvas: PKCanvasView, songId: String, userUid: String) {
        let url = annotationFileURL(songId: songId, userUid: userUid)
        let dir = url.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try canvas.drawing.dataRepresentation().write(to: url, options: [.atomic])
            print("[PencilKit] Saved drawing")
        } catch {
            print("[PencilKit] Failed to save: \(error)")
        }
    }
}
