import Capacitor
import WebKit

class MyBridgeViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PencilKitAnnotatorPlugin())
        bridge?.registerPluginInstance(WidgetDataPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        injectNativeOverrides()
    }

    // MARK: - Hide web UI elements replaced by native (nav, fab, preloader)

    private func injectNativeOverrides() {
        guard let webView = self.webView else { return }

        // This JS runs at .atDocumentStart — document.head does NOT exist yet.
        // We must use document.documentElement to inject CSS before first paint.
        let js = """
        (function(){
            var css = '.app-nav, .app-fab, .storytelling-preloader { display:none!important; opacity:0!important; visibility:hidden!important; pointer-events:none!important; }';
            var s = document.createElement('style');
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        })();
        """

        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(script)
    }
}
