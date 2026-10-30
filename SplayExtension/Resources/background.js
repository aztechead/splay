browser.action.onClicked.addListener((tab) => browser.tabs.sendMessage(tab.id, "toggle"));

// The text settings are chosen in the Splay app. Pages ask for them as they load; fetch them from the app
// and cache them in storage, where content scripts read them (and react when they change).
browser.runtime.onMessage.addListener(async (message) => {
  if (message !== "settings") return;
  const settings = await browser.runtime.sendNativeMessage("application.id", { type: "settings" });
  const saved = await browser.storage.local.get(Object.keys(settings));
  const changed = Object.fromEntries(Object.entries(settings).filter(([key, value]) => saved[key] !== value));
  if (Object.keys(changed).length) await browser.storage.local.set(changed);
});
