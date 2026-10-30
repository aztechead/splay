import Foundation
import SafariServices

// Answers the extension's request for the settings chosen in the Splay app (shared through the App Group).
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let defaults = UserDefaults(suiteName: "group.com.aztechead.Splay")
        let settings: [String: Any] = [
            "textStyle": defaults?.string(forKey: "textStyle") ?? "hyphenate",
            "textUnderButtons": defaults?.bool(forKey: "textUnderButtons") ?? false,
        ]
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: settings]
        context.completeRequest(returningItems: [response])
    }
}
