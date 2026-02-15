import Foundation
import Capacitor
import PDFKit
import PencilKit

// MARK: - PencilKitAnnotatorPlugin
// Capacitor plugin that bridges JS → native PencilKit PDF annotator.
// Usage from JS: PencilKitAnnotator.openAnnotator({ pdfUrl, songId, userUid })

@available(iOS 14.0, *)
@objc(PencilKitAnnotatorPlugin)
public class PencilKitAnnotatorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PencilKitAnnotatorPlugin"
    public let jsName = "PencilKitAnnotator"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openAnnotator", returnType: CAPPluginReturnPromise)
    ]

    // Track temp files for cleanup
    private var tempPDFURL: URL?

    // MARK: - Plugin Method

    @objc func openAnnotator(_ call: CAPPluginCall) {
        guard let pdfUrlString = call.getString("pdfUrl"),
              let songId = call.getString("songId"),
              let userUid = call.getString("userUid") else {
            call.reject("Missing required parameters: pdfUrl, songId, userUid")
            return
        }

        // Determine if URL is remote or local
        if pdfUrlString.hasPrefix("http://") || pdfUrlString.hasPrefix("https://") {
            // Remote PDF — download to temp first
            downloadPDF(from: pdfUrlString) { [weak self] result in
                switch result {
                case .success(let localURL):
                    self?.tempPDFURL = localURL
                    self?.presentAnnotator(pdfURL: localURL, songId: songId, userUid: userUid, call: call)
                case .failure(let error):
                    call.reject("Failed to download PDF: \(error.localizedDescription)")
                }
            }
        } else if pdfUrlString.hasPrefix("data:") {
            // Base64 data URI
            handleBase64PDF(dataURI: pdfUrlString, songId: songId, userUid: userUid, call: call)
        } else {
            // Local file path
            let fileURL = URL(fileURLWithPath: pdfUrlString)
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                call.reject("PDF file not found at path: \(pdfUrlString)")
                return
            }
            presentAnnotator(pdfURL: fileURL, songId: songId, userUid: userUid, call: call)
        }
    }

    // MARK: - Remote PDF Download

    private func downloadPDF(from urlString: String, completion: @escaping (Result<URL, Error>) -> Void) {
        guard let url = URL(string: urlString) else {
            completion(.failure(NSError(domain: "PencilKitAnnotator", code: -1,
                                       userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])))
            return
        }

        // Check if already downloaded (avoid repeated downloads)
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "pencilkit_pdf_\(url.lastPathComponent.hashValue).pdf"
        let tempFileURL = tempDir.appendingPathComponent(fileName)

        if FileManager.default.fileExists(atPath: tempFileURL.path) {
            print("[PencilKitAnnotator] Using cached temp PDF: \(tempFileURL.path)")
            completion(.success(tempFileURL))
            return
        }

        let task = URLSession.shared.downloadTask(with: url) { downloadedURL, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let downloadedURL = downloadedURL else {
                completion(.failure(NSError(domain: "PencilKitAnnotator", code: -2,
                                           userInfo: [NSLocalizedDescriptionKey: "No file downloaded"])))
                return
            }

            // Validate response
            if let httpResponse = response as? HTTPURLResponse,
               !(200...299).contains(httpResponse.statusCode) {
                completion(.failure(NSError(domain: "PencilKitAnnotator", code: httpResponse.statusCode,
                                           userInfo: [NSLocalizedDescriptionKey: "HTTP \(httpResponse.statusCode)"])))
                return
            }

            do {
                // Move to our named temp location (atomic via file system)
                if FileManager.default.fileExists(atPath: tempFileURL.path) {
                    try FileManager.default.removeItem(at: tempFileURL)
                }
                try FileManager.default.moveItem(at: downloadedURL, to: tempFileURL)
                completion(.success(tempFileURL))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }

    // MARK: - Base64 PDF handling

    private func handleBase64PDF(dataURI: String, songId: String, userUid: String, call: CAPPluginCall) {
        // Format: data:application/pdf;base64,XXXX
        guard let commaIndex = dataURI.firstIndex(of: ",") else {
            call.reject("Invalid base64 data URI")
            return
        }

        let base64String = String(dataURI[dataURI.index(after: commaIndex)...])
        guard let data = Data(base64Encoded: base64String) else {
            call.reject("Failed to decode base64 PDF data")
            return
        }

        let tempDir = FileManager.default.temporaryDirectory
        let tempFileURL = tempDir.appendingPathComponent("pencilkit_b64_\(songId).pdf")

        do {
            try data.write(to: tempFileURL, options: [.atomic])
            self.tempPDFURL = tempFileURL
            presentAnnotator(pdfURL: tempFileURL, songId: songId, userUid: userUid, call: call)
        } catch {
            call.reject("Failed to write base64 PDF to temp: \(error.localizedDescription)")
        }
    }

    // MARK: - Presentation

    private func presentAnnotator(pdfURL: URL, songId: String, userUid: String, call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  let viewController = self.bridge?.viewController else {
                call.reject("Could not access view controller")
                return
            }

            let annotatorVC = PDFAnnotationViewController(
                pdfURL: pdfURL,
                songId: songId,
                userUid: userUid
            )

            let nav = UINavigationController(rootViewController: annotatorVC)
            nav.modalPresentationStyle = .fullScreen

            // Style the navigation bar
            let appearance = UINavigationBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = .white
            appearance.titleTextAttributes = [.foregroundColor: UIColor.black]
            nav.navigationBar.standardAppearance = appearance
            nav.navigationBar.scrollEdgeAppearance = appearance
            nav.navigationBar.tintColor = .systemBlue

            viewController.present(nav, animated: true) {
                call.resolve()
            }
        }
    }

    // MARK: - Cleanup

    /// Called when plugin is being deactivated — clean up temp files
    deinit {
        if let tempURL = tempPDFURL {
            try? FileManager.default.removeItem(at: tempURL)
        }
    }
}
