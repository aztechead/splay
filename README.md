# Splay

A Safari extension for the iPhone Duo. On the front screen, Safari keeps its buttons in a column on the right and lays pages out beside it. Splay widens pages to the full screen. Images and backgrounds extend under the buttons and lines of text stop at their edge. Links or buttons that would sit under the camera or one of Safari's buttons are moved left.

Support and privacy pages live in [splay-site](https://github.com/aztechead/splay-site).

## Layout

- `Splay/`: the app. It shows the setup steps and the text style setting.
- `SplayExtension/`: the Safari web extension. `Resources/content.js` does the layout work.
- `project.yml`: the XcodeGen spec. Run `xcodegen generate` after adding or removing files.

## How it works

On the front screen, Safari lays pages out 382 points wide, but its web view covers all 466. `content.js` rewrites each page's viewport tag to the full width before the page is first laid out, pads blocks of text so lines stop at the button column, and moves tap targets that would sit under the camera or a button.

The positions of the camera and Safari's buttons were measured on an iPhone Duo running iOS 27.2 and are constants at the top of `content.js`. If a Safari update moves the buttons, those numbers need updating.

## Building your own copy

You need Xcode 27.2 or later, [XcodeGen](https://github.com/yonaskolb/XcodeGen) and an iPhone Duo.

1. In `project.yml`, set `DEVELOPMENT_TEAM` to your team ID and change the bundle IDs `com.aztechead.Splay` and `com.aztechead.Splay.Extension` to your own.
2. Change the App Group `group.com.aztechead.Splay` to one of yours. It appears in `project.yml` (twice), `Splay/SplayApp.swift` and `SplayExtension/SafariWebExtensionHandler.swift`.
3. Run `xcodegen generate`, open `Splay.xcodeproj` and run the app on your Duo.
4. In Settings › Apps › Safari › Extensions › Splay, turn on Allow Extension and set All Websites to Allow.

Test on the phone itself. Safari in the iPhone Duo simulator doesn't lay out or redraw pages the same way.

## License

MIT. See [LICENSE](LICENSE).
