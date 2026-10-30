// On the Duo's front screen Safari lays pages out beside its button column, but the web view
// extends underneath it. Declaring the viewport as wide as the screen lays the page out across
// that space; the buttons float on top. (Widening <html> alone isn't enough: WebKit clips
// position:fixed elements to the layout viewport, which only the viewport meta can change.)
const FRONT_SCREEN_WIDTH = 466; // points, the screen's short side
const root = document.documentElement;
const site = location.hostname;
let off = false;
let meta, orig, wrote; // the page's viewport meta, its own content, and what we last set
let active = false; // widened right now

// Where Safari's buttons and the camera sit on the front screen, in points, measured on an iPhone Duo with
// iOS 27.2. x counts toward the button column: in landscape-primary Safari puts the column on the left,
// so its x values are mirrored (678 - x) and rect() mirrors page boxes to match.
// edge: where lines of text stop. top: what content that scrolls meets where it sits at the top of the page
// (the camera, or Safari's top buttons). column: everything there, checked against fixed elements.
const SCREENS = {
  portrait: { width: 466, edge: 392, top: [[388, 12, 466, 155]], column: [[388, 12, 466, 390], [388, 535, 466, 648]] },
  "landscape-secondary": { width: 678, edge: 605, top: [[601, 20, 678, 136]], column: [[601, 20, 678, 136], [601, 278, 678, 388], [523, 388, 678, 466]] },
  "landscape-primary": { width: 678, edge: 605, left: true, top: [[523, 0, 666, 78], [601, 78, 678, 194]], column: [[523, 0, 678, 78], [601, 78, 678, 194], [601, 326, 678, 436]] },
};
const COLUMN_WIDTH = 84; // points Safari keeps beside the page for its buttons
const layout = () => SCREENS[screen.orientation.type.startsWith("portrait") ? "portrait" : screen.orientation.type];

// Safari's Advanced Fingerprinting Protection reports a made-up screen size, so when the screen doesn't
// read as the front screen, check Safari's visible area instead: in points it is the screen's width less
// the button column (or the full width, once widened) and shorter than the screen. That holds from the
// first parse, before the viewport tag applies, and after widening. No iPhone screen is 382 or 594 wide.
function frontScreen() {
  if (Math.min(screen.width, screen.height) === FRONT_SCREEN_WIDTH) return true;
  const zoom = visualViewport.scale;
  const width = innerWidth * zoom;
  const height = innerHeight * zoom;
  const nearly = (a, b) => Math.abs(a - b) < 2;
  const full = layout().width;
  const short = full === FRONT_SCREEN_WIDTH ? height > 500 && height < 680 : height > 300 && height < 470;
  return (nearly(width, full - COLUMN_WIDTH) || nearly(width, full)) && short;
}

function widen() {
  if (!meta) return;
  const on = !off && frontScreen();
  active = on;
  // Safari's Page Zoom shows up as visualViewport.scale and is applied after load, with a resize.
  // Later keys override earlier ones, so the page's other settings (viewport-fit etc.) survive.
  // height is explicit because WebKit would otherwise scale it up with the width, and a layout
  // viewport taller than the visual one lets fixed elements drift when Safari collapses its bars.
  const zoom = visualViewport.scale;
  const want = on
    ? `${orig}, width=${layout().width / zoom}, height=device-height, initial-scale=1, minimum-scale=1`
    : orig;
  const changed = wrote !== want;
  wrote = want;
  if (meta.content !== want) meta.content = want;
  // The wide layout overhangs Safari's narrow visual viewport; stop the page panning sideways into it.
  // Nested horizontal scrollers (carousels) still work: the root's touch-action only gates the page.
  if (on) root.style.setProperty("touch-action", "pan-y pinch-zoom", "important");
  else root.style.removeProperty("touch-action");
  root.toggleAttribute("data-splay", on); // content.css hides the horizontal scroll bar on widened pages
  if (changed) requestAnimationFrame(arrange);
}

// Re-fit everything to the current layout: narrow the text, then move tap targets clear.
function arrange() {
  undo();
  narrowed = new WeakSet();
  if (!active) return;
  align();
  if (!textUnderButtons) narrow([root]);
  dodge();
}

// Safari counts only the strip beside its buttons as the window, so a widened page can scroll sideways by
// the width of the column. Keep it in place: at the left edge, or with the column on the left (where the
// extra width lands off the right edge), scrolled by the column's width so the page starts under it.
function align(smooth = false) {
  if (!active) return;
  const x = layout().left ? COLUMN_WIDTH / visualViewport.scale : 0;
  if (Math.abs(scrollX - x) > 0.5) scrollTo({ left: x, behavior: smooth ? "smooth" : "instant" });
}

// A finger can still pan the page sideways (Safari ignores touch-action for it), and correcting that
// mid-gesture makes it judder. So once scrolling has stopped and no finger is down, glide it back.
// That also catches pages that scroll themselves, like scrollTo(0, 0) on navigation.
let touches = 0;
let settle = 0;
const track = (event) => (touches = event.touches.length);
for (const type of ["touchstart", "touchend", "touchcancel"]) addEventListener(type, track, { passive: true, capture: true });
function settled() {
  clearTimeout(settle);
  settle = setTimeout(() => (touches ? settled() : align(true)), 300);
}

// A page box in CSS pixels with x counted toward the button column, like SCREENS.
function rect(el) {
  const r = el.getBoundingClientRect();
  if (!layout().left) return r;
  const x = root.getBoundingClientRect().left;
  const width = layout().width / visualViewport.scale;
  return { left: width - (r.right - x), right: width - (r.left - x), top: r.top, bottom: r.bottom, width: r.width, height: r.height };
}
const side = () => (layout().left ? "Left" : "Right"); // the side of a box facing the column

// Lines of text stop at Safari's button column; images, video and backgrounds keep the full width.
// Each text block reaching past the column gets right padding, so its box (and background) stays wide.
let narrowed = new WeakSet();
let textStyle = "hyphenate"; // "hyphenate", "justify" or "ragged", set in the Splay app
let textUnderButtons = false; // opt-in in the Splay app: lines run the full width, under the buttons
function narrow(roots) {
  const edge = layout().edge / visualViewport.scale;
  const facing = side();
  const width = root.clientWidth;
  const blocks = new Set();
  for (const from of roots) {
    const walker = document.createTreeWalker(from, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.data.trim()) continue;
      const block = blockOf(text.parentElement);
      if (block && !narrowed.has(block)) blocks.add(block);
    }
  }
  // Measure everything, then write everything: one layout instead of one per block.
  const over = [];
  const prose = []; // left-aligned body text, justified below if it ends up running to the column
  // Blocks that hold other text blocks aren't justified: it would be inherited by headings inside them.
  const containers = new Set();
  for (const block of blocks) {
    for (let e = block.parentElement; e; e = e.parentElement) if (blocks.has(e)) containers.add(e);
  }
  for (const block of blocks) {
    const font = getComputedStyle(block);
    const heading = /^H[1-6]$/.test(block.tagName) || parseFloat(font.fontSize) >= 22;
    if (!heading && !containers.has(block) && /start|left|justify/.test(font.textAlign)) prose.push(block);
    if (nestedIn(block, blocks)) continue; // padding the outer block narrows this one too
    const r = rect(block);
    if (r.right <= edge || r.left >= edge || placement(block) === "scroller") continue;
    if (block.matches(CONTROLS) && r.width <= width * 0.4) continue; // a button: dodge() moves it whole instead
    // Pad from the border edge so the content box (where the text runs) ends exactly at the column.
    const style = getComputedStyle(block);
    const padding = r.right - parseFloat(style[`border${facing}Width`]) - edge;
    if (padding <= parseFloat(style[`padding${facing}`])) continue; // its own padding already keeps the text clear
    over.push([block, padding]);
  }
  for (const [block, padding] of over) {
    narrowed.add(block);
    set(block, `padding-${facing.toLowerCase()}`, `${padding}px`);
  }
  // Justify body text that now runs to the column (and hyphenate it, if chosen in the app), so every
  // line ends right at the buttons. Headings keep their ragged edge (a few big words spread across a
  // line look broken), and centred or right-aligned text keeps its alignment.
  if (textStyle === "ragged") return;
  for (const block of prose) {
    if (!narrowed.has(block) && !nestedIn(block, narrowed)) continue;
    set(block, "text-align", "justify");
    if (textStyle === "hyphenate") set(block, "hyphens", "auto");
  }
}

// The nearest block-level element holding a piece of text (not a span, link or other inline).
function blockOf(el) {
  for (let e = el; e && e !== root; e = e.parentElement) {
    const display = getComputedStyle(e).display;
    if (display === "none") return null;
    if (!display.startsWith("inline") && display !== "contents") return e;
  }
  return null;
}

function nestedIn(el, set) {
  for (let e = el.parentElement; e; e = e.parentElement) if (set.has(e)) return true;
  return false;
}

// Text a page adds later (infinite scroll, client-side navigation) gets narrowed in batches.
let added = new Set();
let pending = 0;
function queue(records) {
  if (!active || textUnderButtons) return;
  for (const record of records) {
    for (const node of record.addedNodes) {
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (el) added.add(el);
    }
  }
  if (!added.size || pending) return;
  pending = setTimeout(() => {
    pending = 0;
    const roots = [...added].filter((el) => el.isConnected);
    added.clear();
    if (active) narrow(roots);
  }, 200);
}

// What sits on top of the page on the front screen, in points: [left, top, right, bottom].
// The camera heads the column (a Live Activity grows down out of it). Under it come the time,
// connectivity, back and bookmarks, which slide ~90pt lower while a Live Activity shows; the column
// box covers that lower layout. New tab and tabs sit at the bottom.
const GAP = 6; // points of clearance
const CONTROLS =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';

// Images and backgrounds may run under all of that, but things to tap shouldn't. Content that scrolls only
// meets the camera, at the top of the page; fixed elements stay put, so they also avoid Safari's buttons.
// This runs at load and again a few seconds later, so tap targets a page adds after that aren't moved.
let moved = []; // [element, property, previous inline value]
function set(el, property, value) {
  moved.push([el, property, el.style.getPropertyValue(property)]);
  el.style.setProperty(property, value, "important");
}
function undo(count = moved.length) {
  for (const [el, property, value] of moved.splice(-count, count).reverse()) {
    if (value) el.style.setProperty(property, value);
    else el.style.removeProperty(property);
  }
}

function dodge() {
  const zoom = visualViewport.scale;
  const css = (box) => box.map((v) => v / zoom);
  const top = layout().top.map(css);
  const column = layout().column.map(css);
  const reach = Math.min(...column.map((box) => box[0]));
  const facing = side();
  const away = facing === "Left" ? 1 : -1; // translate direction away from the column
  const width = root.clientWidth;
  for (const control of document.querySelectorAll(CONTROLS)) {
    const r = rect(control);
    if (r.right <= reach || !r.height || r.width > width * 0.4) continue;
    const position = placement(control);
    if (position === "scroller") continue; // side-scrolling strips bring their items out from under by themselves
    const dy = position ? 0 : scrollY; // scrolling content is checked where it sits at the top of the page
    const hits = (box) => box[0] < r.right && r.left < box[2] && box[1] < r.bottom + dy && r.top + dy < box[3];
    const blocker = (position === "fixed" ? column : top).find(hits);
    if (!blocker) continue;
    const shift = r.right - blocker[0] + GAP / zoom;
    // Pad the row the control sits in, so its neighbours move left with it instead of being overlapped.
    const row = rowOf(control, r, width);
    if (row) {
      set(row, `padding-${facing.toLowerCase()}`, `${parseFloat(getComputedStyle(row)[`padding${facing}`]) + shift}px`);
      if (rect(control).right <= blocker[0]) continue;
      undo(1); // positioned out of the row's flow, so padding doesn't reach it
    }
    // Otherwise move the small group around the control (e.g. subscribe, search and menu) as one.
    const cluster = clusterOf(control, width);
    set(cluster, "translate", `${(parseFloat(cluster.style.translate) || 0) + away * shift}px`);
  }
}

// "fixed" or "sticky" for the nearest such ancestor, "scroller" inside a side-scrolling strip, "" otherwise.
function placement(el) {
  for (let e = el; e && e !== root; e = e.parentElement) {
    const style = getComputedStyle(e);
    if (style.position === "fixed" || style.position === "sticky") return style.position;
    if (e !== el && /auto|scroll/.test(style.overflowX) && e.scrollWidth > e.clientWidth + 1) return "scroller";
  }
  return "";
}

// The largest ancestor that is still a small group: under half the page wide and one row tall.
function clusterOf(control, width) {
  let cluster = control;
  for (let e = control.parentElement; e && e !== document.body; e = e.parentElement) {
    const box = e.getBoundingClientRect();
    if (box.width > width * 0.5 || box.height > 120) break;
    cluster = e;
  }
  return cluster;
}

// A header-like row: most of the page wide, reaching the control's right edge, not a whole page section.
function rowOf(control, r, width) {
  for (let e = control.parentElement; e && e !== document.body; e = e.parentElement) {
    const box = rect(e);
    if (box.height > 200) return null;
    if (box.width >= width * 0.6 && box.right >= r.right - 1) return e;
  }
  return null;
}

// This runs at document_start so the very first layout is already wide: a page laid out narrow
// first stays clipped at the narrow width after a reload. The meta isn't parsed yet, so watch for it,
// and keep watching: frameworks like Next.js replace or rewrite it when their scripts start. Observer
// callbacks run before the next layout, so the page never gets laid out narrow in between.
// Only mobile layouts (device-width / initial-scale) get widened; a desktop-width page stays as is.
function adopt() {
  const found = document.querySelector('meta[name="viewport"]');
  if (!found || (found === meta && found.content === wrote)) return;
  meta = /device-width|initial-scale/.test(found.content) ? found : undefined;
  orig = found.content;
  if (meta) return widen();
  active = false;
  root.style.removeProperty("touch-action");
  undo();
}
new MutationObserver((records) => {
  adopt();
  queue(records);
}).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
adopt();
addEventListener("resize", widen);
addEventListener("scroll", settled, { passive: true });
// Turning between the two landscapes keeps the size, so no resize, but the column changes sides.
screen.orientation.addEventListener("change", () => {
  widen();
  requestAnimationFrame(arrange);
});
// Headers and floating buttons often arrive with the page's scripts, after the first pass.
addEventListener("DOMContentLoaded", arrange);
addEventListener("load", () => {
  arrange();
  setTimeout(arrange, 1000);
  setTimeout(arrange, 3000);
});

// The toolbar button toggles Splay for this site; the choice is kept in extension storage.
browser.runtime.onMessage.addListener(async (message) => {
  if (message !== "toggle") return;
  off = !off;
  await (off ? browser.storage.local.set({ [site]: "off" }) : browser.storage.local.remove(site));
  widen();
});

// Storage is slow to answer, so widen first and undo it if this site is switched off.
browser.storage.local.get([site, "textStyle", "textUnderButtons"]).then((saved) => {
  off = saved[site] === "off";
  const restyle = (saved.textStyle && saved.textStyle !== textStyle) || (saved.textUnderButtons ?? false) !== textUnderButtons;
  textStyle = saved.textStyle ?? textStyle;
  textUnderButtons = saved.textUnderButtons ?? false;
  widen();
  if (restyle) arrange();
});

// The text settings come from the Splay app: the cached copy above, refreshed from the app on every page
// load. A change re-fits open pages.
browser.storage.onChanged.addListener((changes) => {
  if (!changes.textStyle && !changes.textUnderButtons) return;
  if (changes.textStyle) textStyle = changes.textStyle.newValue ?? "hyphenate";
  if (changes.textUnderButtons) textUnderButtons = changes.textUnderButtons.newValue ?? false;
  arrange();
});
browser.runtime.sendMessage("settings");
// Coming back to Safari, for example from the Splay app, picks up new settings without a reload.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") browser.runtime.sendMessage("settings");
});
