/**
 * The only on-page feedback Arlo draws: a box around the element it is about to
 * touch, plus a short label. No floating controls, no overlays, no spotlight.
 */
const HOST_ID = 'arlo-highlight-host';

const STYLES = `
  :host { all: initial; }
  .box {
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    border: 2px solid #4f7cff;
    border-radius: 6px;
    box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.25);
    transition: top 90ms linear, left 90ms linear, width 90ms linear, height 90ms linear;
  }
  .label {
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    max-width: 320px;
    padding: 4px 8px;
    border-radius: 6px;
    background: #1b2333;
    color: #f5f7ff;
    font: 500 12px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

interface Overlay {
  host: HTMLElement;
  box: HTMLElement;
  label: HTMLElement;
}

let overlay: Overlay | null = null;
let tracked: Element | null = null;
let frame = 0;

function ensureOverlay(): Overlay {
  if (overlay?.host.isConnected) return overlay;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = STYLES;
  const box = document.createElement('div');
  box.className = 'box';
  const label = document.createElement('div');
  label.className = 'label';

  shadow.append(style, box, label);
  document.documentElement.append(host);

  overlay = { host, box, label };
  return overlay;
}

function position(): void {
  if (!overlay || !tracked?.isConnected) return;
  const rect = tracked.getBoundingClientRect();
  const { box, label } = overlay;
  box.style.top = `${rect.top - 2}px`;
  box.style.left = `${rect.left - 2}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;

  const above = rect.top > 28;
  label.style.top = above ? `${rect.top - 26}px` : `${rect.bottom + 6}px`;
  label.style.left = `${Math.max(4, rect.left - 2)}px`;
}

function track(): void {
  position();
  frame = requestAnimationFrame(track);
}

export function highlight(element: Element, text: string): void {
  const { label } = ensureOverlay();
  label.textContent = text;
  tracked = element;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (!frame) track();
}

export function clearHighlight(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  tracked = null;
  overlay?.host.remove();
  overlay = null;
}
