browser.action.onClicked.addListener((tab) => browser.tabs.sendMessage(tab.id, "toggle"));

// The text style is chosen in the Splay app. Pages ask for it as they load; fetch it from the app and
// cache it in storage, where content scripts read it (and react when it changes).
browser.runtime.onMessage.addListener(async (message) => {
  if (message !== "settings") return;
  const { textStyle } = await browser.runtime.sendNativeMessage("application.id", { type: "settings" });
  const saved = await browser.storage.local.get("textStyle");
  if (saved.textStyle !== textStyle) await browser.storage.local.set({ textStyle });
});
