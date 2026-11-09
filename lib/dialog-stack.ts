type Entry = { panel: HTMLElement; close: () => void; previousFocus: HTMLElement | null };
const dialogs: Entry[] = [];
const inertBefore = new Map<HTMLElement, boolean>();
let originalOverflow = "";
const selector = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]";

function focusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert], [hidden], [aria-hidden='true']") && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
}
function focusFirst(panel: HTMLElement) {
  const elements = focusable(panel);
  (elements.find(element => element.hasAttribute("data-dialog-autofocus")) ?? elements[0] ?? panel).focus();
}
function syncBackground() {
  inertBefore.forEach((inert, element) => { element.inert = inert; });
  inertBefore.clear();
  const top = dialogs[dialogs.length - 1];
  if (!top) return;
  let branch: HTMLElement = top.panel;
  while (branch.parentElement) {
    for (const sibling of Array.from(branch.parentElement.children)) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        inertBefore.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    if (branch.parentElement === document.body) break;
    branch = branch.parentElement;
  }
}
function handleKey(event: KeyboardEvent) {
  const top = dialogs[dialogs.length - 1];
  if (!top) return;
  if (event.key === "Escape") {
    // A component may handle Escape itself (for example, leave a search workflow).
    if (!event.defaultPrevented) { event.preventDefault(); top.close(); }
    event.stopImmediatePropagation();
  } else if (event.key === "Tab" && !event.defaultPrevented) {
    const elements = focusable(top.panel);
    const first = elements[0];
    const last = elements[elements.length - 1];
    const outside = !top.panel.contains(document.activeElement) || document.activeElement === top.panel;
    if (!first || outside || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last ?? top.panel : first ?? top.panel).focus();
    }
  }
}
function handleFocus(event: FocusEvent) {
  const top = dialogs[dialogs.length - 1];
  if (top && event.target instanceof Node && !top.panel.contains(event.target)) focusFirst(top.panel);
}
export function isTopDialog(panel: HTMLElement | null): boolean { return Boolean(panel && dialogs[dialogs.length - 1]?.panel === panel); }

export function registerDialog(panel: HTMLElement, close: () => void, returnFocus?: HTMLElement | null): () => void {
  const entry = { panel, close, previousFocus: returnFocus === undefined ? (document.activeElement instanceof HTMLElement ? document.activeElement : null) : returnFocus };
  if (!dialogs.length) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocus, true);
  }
  dialogs.push(entry);
  syncBackground();
  focusFirst(panel);
  return () => {
    const index = dialogs.indexOf(entry);
    if (index < 0) return;
    const wasTop = isTopDialog(panel);
    dialogs.splice(index, 1);
    // Preserve the trigger if a parent unmounts before its child.
    for (const remaining of dialogs) if (remaining.previousFocus && panel.contains(remaining.previousFocus)) remaining.previousFocus = entry.previousFocus;
    syncBackground();
    const top = dialogs[dialogs.length - 1];
    if (!dialogs.length) {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", handleFocus, true);
    }
    if (wasTop) {
      if (entry.previousFocus?.isConnected && !entry.previousFocus.closest("[inert]")) entry.previousFocus.focus();
      else if (top) focusFirst(top.panel);
    }
  };
}
