import Foundation
import Capacitor
import UIKit

/// Capacitor plugin that opens a fully native PDFKit + PencilKit viewer.
/// Single method: openNativePdfViewer.
/// No WKWebView overlay. No hybrid solution.
@objc(PencilKitAnnotatorPlugin)
public class PencilKitAnnotatorPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "PencilKitAnnotatorPlugin"
    public let jsName = "PencilKitAnnotator"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openNativePdfViewer", returnType: CAPPluginReturnPromise),
    ]

    private weak var currentVC: NativePdfViewController?

    // MARK: - Open Native PDF Viewer

    @objc func openNativePdfViewer(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Plugin deallocated")
                return
            }

            // Prevent double presentation
            if self.currentVC != nil {
                self.currentVC?.dismiss(animated: false, completion: nil)
                self.currentVC = nil
            }

            guard let partsArray = call.getArray("parts") as? [[String: Any]],
                  let songId = call.getString("songId"),
                  let userUid = call.getString("userUid") else {
                call.reject("Missing parts array, songId, or userUid")
                return
            }

            let initialPartIndex = call.getInt("initialPartIndex") ?? 0
            let title = call.getString("title")
            let isArchive = call.getBool("isArchive") ?? false

            var parts: [NativePdfViewController.PDFPart] = []
            for dict in partsArray {
                if let name = dict["name"] as? String, let pdfUrl = dict["pdfUrl"] as? String {
                    parts.append(NativePdfViewController.PDFPart(name: name, urlString: pdfUrl))
                }
            }

            if parts.isEmpty {
                call.reject("Parts array is empty or invalid")
                return
            }

            guard let bridgeVC = self.bridge?.viewController else {
                call.reject("No view controller available")
                return
            }

            let vc = NativePdfViewController(
                parts: parts,
                initialPartIndex: initialPartIndex,
                songId: songId,
                userUid: userUid,
                title: title,
                isArchive: isArchive
            )

            vc.onArchiveAdd = { [weak self] partIndex in
                if let idx = partIndex {
                    self?.notifyListeners("onArchiveAdd", data: ["songId": songId, "partIndex": idx])
                } else {
                    self?.notifyListeners("onArchiveAdd", data: ["songId": songId])
                }
            }

            vc.onSettingsTapped = { [weak self] in
                self?.notifyListeners("onSettingsTapped", data: ["songId": songId])
            }

            vc.onDismiss = { action in
                call.resolve([
                    "action": action
                ])
                vc.cleanup()
            }

            self.currentVC = vc
            bridgeVC.present(vc, animated: true)
        }
    }
}
