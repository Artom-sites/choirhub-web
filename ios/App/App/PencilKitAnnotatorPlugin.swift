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
        guard let partsArray = call.getArray("parts") as? [[String: Any]],
              let songId = call.getString("songId"),
              let userUid = call.getString("userUid") else {
            call.reject("Missing parts array, songId, or userUid")
            return
        }

        let initialPartIndex = call.getInt("initialPartIndex") ?? 0
        let title = call.getString("title")

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

        // Present viewer IMMEDIATELY — it handles loading internally
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let bridgeVC = self.bridge?.viewController else {
                call.reject("No view controller available")
                return
            }

            let vc = NativePdfViewController(
                parts: parts,
                initialPartIndex: initialPartIndex,
                songId: songId,
                userUid: userUid,
                title: title
            )

            vc.onDismiss = {
                call.resolve()
                vc.cleanup()
            }

            self.currentVC = vc
            bridgeVC.present(vc, animated: true)
        }
    }
}
