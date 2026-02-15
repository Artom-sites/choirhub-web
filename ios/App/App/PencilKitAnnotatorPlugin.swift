import Foundation
import Capacitor
import UIKit
import PencilKit

/// Simple PencilKit overlay plugin.
/// startAnnotating: adds a transparent PKCanvasView over the web view + shows tool picker.
/// stopAnnotating:  saves the drawing, removes the canvas + hides tool picker.
/// Works exactly like the web annotation toggle — no extra screens.
@objc(PencilKitAnnotatorPlugin)
public class PencilKitAnnotatorPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PencilKitAnnotatorPlugin"
    public let jsName = "PencilKitAnnotator"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startAnnotating", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAnnotating", returnType: CAPPluginReturnPromise),
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

            // Remove previous canvas if any
            self.cleanupCanvas()

            self.currentSongId = songId
            self.currentUserUid = userUid

            // Create transparent canvas over the web view
            let canvas = PKCanvasView()
            canvas.backgroundColor = .clear
            canvas.isOpaque = false
            canvas.drawingPolicy = .anyInput
            canvas.isScrollEnabled = false  // Don't scroll the canvas itself
            canvas.translatesAutoresizingMaskIntoConstraints = false

            // Offset from top so the header/nav buttons remain tappable
            let topOffset = CGFloat(call.getFloat("topOffset") ?? 0)

            // Add on top of the web view, below the header
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

    // MARK: - Stop Annotating

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

            self.cleanupCanvas()

            print("[PencilKit] Stopped annotating")
            call.resolve()
        }
    }

    // MARK: - Cleanup

    private func cleanupCanvas() {
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
