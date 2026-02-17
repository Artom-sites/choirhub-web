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
        guard let pdfUrlString = call.getString("pdfUrl"),
              let songId = call.getString("songId"),
              let userUid = call.getString("userUid") else {
            call.reject("Missing pdfUrl, songId, or userUid")
            return
        }

        let title = call.getString("title")

        // Determine source type
        let source: NativePdfViewController.PDFSource

        if pdfUrlString.hasPrefix("data:") {
            source = .base64(pdfUrlString)
        } else if let url = URL(string: pdfUrlString) {
            if url.isFileURL {
                source = .fileURL(url)
            } else {
                source = .remoteURL(url)
            }
        } else {
            call.reject("Invalid PDF URL")
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
                source: source,
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
