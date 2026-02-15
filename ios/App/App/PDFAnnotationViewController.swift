import UIKit
import PDFKit
import PencilKit

// MARK: - PDFAnnotationViewController
// Renders a PDF with a PencilKit canvas overlay.
// Drawing is saved per (songId, userUid) in the app Documents directory.
// No Firestore, no global mutation.

@available(iOS 14.0, *)
final class PDFAnnotationViewController: UIViewController {

    // MARK: - Configuration
    private let pdfURL: URL          // local file URL
    private let songId: String
    private let userUid: String

    // MARK: - UI
    private let pdfView = PDFView()
    private let canvasView = PKCanvasView()
    private var toolPicker: PKToolPicker?

    // MARK: - State
    private var isFirstLayout = true

    // MARK: - Init
    init(pdfURL: URL, songId: String, userUid: String) {
        self.pdfURL = pdfURL
        self.songId = songId
        self.userUid = userUid
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        setupNavBar()
        setupPDFView()
        setupCanvasView()
        loadPDF()
        loadAnnotation()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        showToolPicker()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        saveAnnotation()
        hideToolPicker()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        syncCanvasFrame()
    }

    // MARK: - Navigation Bar

    private func setupNavBar() {
        title = "Анотації"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Готово",
            style: .done,
            target: self,
            action: #selector(doneTapped)
        )

        // Clear button on the right
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Очистити",
            style: .plain,
            target: self,
            action: #selector(clearTapped)
        )
    }

    @objc private func doneTapped() {
        saveAnnotation()
        dismiss(animated: true)
    }

    @objc private func clearTapped() {
        let alert = UIAlertController(
            title: "Очистити анотації?",
            message: "Всі малюнки на цій сторінці будуть видалені.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Скасувати", style: .cancel))
        alert.addAction(UIAlertAction(title: "Очистити", style: .destructive) { [weak self] _ in
            self?.canvasView.drawing = PKDrawing()
        })
        present(alert, animated: true)
    }

    // MARK: - PDFView Setup

    private func setupPDFView() {
        pdfView.translatesAutoresizingMaskIntoConstraints = false
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.autoScales = true
        pdfView.backgroundColor = .white

        // Disable native PDF annotations (we use PencilKit instead)
        if #available(iOS 16.0, *) {
            pdfView.isInMarkupMode = false
        }

        view.addSubview(pdfView)
        NSLayoutConstraint.activate([
            pdfView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            pdfView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pdfView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pdfView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    // MARK: - Canvas Setup

    private func setupCanvasView() {
        canvasView.translatesAutoresizingMaskIntoConstraints = false
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.drawingPolicy = .anyInput  // Both finger + Apple Pencil

        // Canvas must sit ON TOP of the PDF's document scroll view
        // We'll add it as a subview of the PDFView's internal scroll view
        // This way it scrolls and zooms with the PDF automatically — zero drift.
    }

    /// Adds the canvas to the PDF's internal document view so it tracks scroll/zoom natively.
    private func attachCanvasToPDFDocumentView() {
        // PDFView uses an internal scrollView.
        // PDFView.documentView is the content view inside that scroll view.
        guard let documentView = pdfView.documentView else { return }

        // Remove from previous parent if re-attaching
        if canvasView.superview != nil && canvasView.superview !== documentView {
            canvasView.removeFromSuperview()
        }

        if canvasView.superview == nil {
            documentView.addSubview(canvasView)
        }

        // Match canvas frame to document view bounds (full PDF content area)
        canvasView.frame = documentView.bounds

        // Canvas must not interfere with PDF scroll
        canvasView.isScrollEnabled = false

        // Ensure canvas is on top
        documentView.bringSubviewToFront(canvasView)
    }

    /// Called on every layout pass to keep canvas in sync.
    private func syncCanvasFrame() {
        guard let documentView = pdfView.documentView else { return }

        if canvasView.superview == nil {
            attachCanvasToPDFDocumentView()
        }

        let docBounds = documentView.bounds
        if canvasView.frame != docBounds {
            canvasView.frame = docBounds
        }

        documentView.bringSubviewToFront(canvasView)

        // On first layout, scale existing drawing to match document size
        if isFirstLayout && docBounds.width > 0 {
            isFirstLayout = false
        }
    }

    // MARK: - Tool Picker

    private func showToolPicker() {
        let picker = PKToolPicker()
        picker.setVisible(true, forFirstResponder: canvasView)
        picker.addObserver(canvasView)
        canvasView.becomeFirstResponder()
        self.toolPicker = picker
    }

    private func hideToolPicker() {
        toolPicker?.setVisible(false, forFirstResponder: canvasView)
        toolPicker?.removeObserver(canvasView)
        canvasView.resignFirstResponder()
        toolPicker = nil
    }

    // MARK: - PDF Loading

    private func loadPDF() {
        guard let document = PDFDocument(url: pdfURL) else {
            print("[PDFAnnotation] Failed to load PDF from: \(pdfURL)")
            showErrorAndDismiss("Не вдалося відкрити PDF")
            return
        }
        pdfView.document = document

        // Wait for PDF to lay out, then attach canvas
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.attachCanvasToPDFDocumentView()
        }
    }

    // MARK: - Annotation Persistence

    /// Storage path: Documents/annotations/annotation_{songId}_{userUid}.pkdrawing
    private var annotationFileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("annotations", isDirectory: true)
        return dir.appendingPathComponent("annotation_\(songId)_\(userUid).pkdrawing")
    }

    private func loadAnnotation() {
        let fileURL = annotationFileURL
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("[PDFAnnotation] No saved annotation found at: \(fileURL.path)")
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let drawing = try PKDrawing(data: data)
            canvasView.drawing = drawing
            print("[PDFAnnotation] Loaded annotation (\(data.count) bytes)")
        } catch {
            // Corrupted file — delete it and start fresh
            print("[PDFAnnotation] Corrupted annotation file, removing: \(error)")
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    private func saveAnnotation() {
        let drawing = canvasView.drawing
        let data = drawing.dataRepresentation()
        let fileURL = annotationFileURL

        // Ensure directory exists
        let dir = fileURL.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            print("[PDFAnnotation] Failed to create annotations directory: \(error)")
            return
        }

        // Atomic write — prevents corruption on crash/kill
        do {
            try data.write(to: fileURL, options: [.atomic])
            print("[PDFAnnotation] Saved annotation (\(data.count) bytes) to: \(fileURL.path)")
        } catch {
            print("[PDFAnnotation] Failed to save annotation: \(error)")
        }
    }

    // MARK: - Error Handling

    private func showErrorAndDismiss(_ message: String) {
        let alert = UIAlertController(title: "Помилка", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak self] _ in
            self?.dismiss(animated: true)
        })
        present(alert, animated: true)
    }
}
