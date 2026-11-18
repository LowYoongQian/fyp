import { api } from '../services/api';

// A button that starts a save answers the press at once: it shows a spinner (index.css) and takes no second press until the server
// replies. Only a request that changes something (POST/PUT/PATCH/DELETE) started right after the press marks it, so loads never do.
const PRESS_WINDOW_MS = 1000;
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);
const SIDE_EFFECTS = ['/notifications/read'];   // marked as read by opening something, not by a save the user asked for
type Marked = { pendingButton?: HTMLElement };
let last: { button: HTMLElement; at: number } | null = null;
const open = new WeakMap<HTMLElement, number>();
const anchored = new WeakSet<HTMLElement>();   // given position: relative here, for its corner spinner

const settle = (config: Marked | undefined) => {
  const button = config?.pendingButton;
  if (!button) return;
  const left = (open.get(button) ?? 1) - 1;
  open.set(button, left);
  if (left > 0) return;
  button.removeAttribute('data-pending');
  if (anchored.delete(button)) button.style.removeProperty('position');
};

const mark = (button: HTMLElement) => {
  if (button.hasAttribute('data-pending')) return;
  // In a flex row the spinner sits after the label; anywhere else (an icon-only button) it would wrap below, so it rides the corner.
  const style = getComputedStyle(button);
  const inline = /flex|grid/.test(style.display);
  if (!inline && style.position === 'static') { button.style.position = 'relative'; anchored.add(button); }
  button.setAttribute('data-pending', inline ? '' : 'corner');
};

export function installPendingButtons() {
  const press = (target: EventTarget | null | undefined, event?: Event) => {
    const button = target instanceof Element ? target.closest<HTMLElement>('button, input[type="submit"]') : null;
    if (!button || button.getAttribute('role') === 'switch') return;   // a switch moves at once and queues its saves: every flip counts
    if (event && button.hasAttribute('data-pending')) {
      // A second press (mouse, Enter or Space) while the first save is on its way would send it twice.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    last = { button, at: performance.now() };
  };
  document.addEventListener('click', event => press(event.target, event), true);
  document.addEventListener('submit', event => press((event as SubmitEvent).submitter), true);
  api.interceptors.request.use(config => {
    const button = last && performance.now() - last.at < PRESS_WINDOW_MS && last.button.isConnected ? last.button : null;
    if (button && MUTATING.has((config.method ?? 'get').toLowerCase()) && !SIDE_EFFECTS.some(path => config.url?.startsWith(path))) {
      (config as typeof config & Marked).pendingButton = button;
      open.set(button, (open.get(button) ?? 0) + 1);
      mark(button);
    }
    return config;
  });
  api.interceptors.response.use(response => { settle(response.config as Marked); return response; },
    error => { settle(error?.config); return Promise.reject(error); });
}
