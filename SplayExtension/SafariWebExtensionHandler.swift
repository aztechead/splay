import Foundation
import SafariServices

// Answers the extension's request for the settings chosen in the Splay app (shared through the App Group).
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let textStyle = UserDefaults(suiteName: "group.com.aztechead.Splay")?.string(forKey: "textStyle") ?? "hyphenate"
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["textStyle": textStyle]]
        context.completeRequest(returningItems: [response])
    }
}
