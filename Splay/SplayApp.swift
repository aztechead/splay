import SwiftUI

enum TextStyle: String, CaseIterable, Identifiable {
    case hyphenate, justify, ragged

    var id: Self { self }

    var title: String {
        switch self {
        case .hyphenate: "Justify and hyphenate"
        case .justify: "Justify"
        case .ragged: "Ragged"
        }
    }

    var detail: String {
        switch self {
        case .hyphenate: "Every line ends at the buttons, with even spacing. Long words split across lines."
        case .justify: "Every line ends at the buttons and no words split, but gaps between words can widen."
        case .ragged: "Text wraps naturally and ends within a word of the buttons."
        }
    }
}

@main
struct SplayApp: App {
    // Shared with the Safari extension through the App Group; SafariWebExtensionHandler reads it.
    @AppStorage("textStyle", store: UserDefaults(suiteName: "group.com.aztechead.Splay"))
    private var textStyle = TextStyle.hyphenate

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                Form {
                    Section {
                        Picker("Text beside the buttons", selection: $textStyle) {
                            ForEach(TextStyle.allCases) { style in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(style.title)
                                    Text(style.detail).font(.footnote).foregroundStyle(.secondary)
                                }
                                .tag(style)
                            }
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    } header: {
                        Text("Text beside Safari's buttons")
                    } footer: {
                        Text("Applies to every site from the next page you open.")
                    }

                    Section {
                        Label("Open Settings › Apps › Safari › Extensions", systemImage: "1.circle.fill")
                        Label("Tap Splay and turn on Allow Extension", systemImage: "2.circle.fill")
                        Label("Set All Websites to Allow", systemImage: "3.circle.fill")
                    } header: {
                        Text("Turn on Splay")
                    } footer: {
                        Text("To turn Splay off for one site, tap Splay in Safari's page menu while on that site.")
                    }

                    Section {
                        Link("Support", destination: URL(string: "https://aztechead.github.io/splay-site/support.html")!)
                        Link("Privacy Policy", destination: URL(string: "https://aztechead.github.io/splay-site/privacy.html")!)
                    }
                }
                .navigationTitle("Splay")
            }
        }
    }
}
