import { useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { animateUiEntrance } from '../utils/uiMotion';

/** Keep anchored menus above cards/modals and inside the visible viewport. */
export function FloatingPanel({ children, style, onDismiss, animateEntrance = true, ...props }: HTMLAttributes<HTMLDivElement> & { onDismiss?: () => void; animateEntrance?: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const escapeAction = useRef<() => void>(() => {});
  const dismissAction = useRef(onDismiss);
  useLayoutEffect(() => { dismissAction.current = onDismiss; }, [onDismiss]);
  useLayoutEffect(() => {
    const node = panel.current;
    let sibling = marker.current?.previousElementSibling;
    let anchor: HTMLElement | null = null;
    while (sibling && !anchor) {
      if (!sibling.classList.contains('fixed')) anchor = sibling.matches('button, input') ? sibling as HTMLElement : sibling.querySelector('input, button');
      sibling = sibling.previousElementSibling;
    }
    anchor ??= marker.current?.parentElement?.querySelector('button, input') ?? null;
    if (!node || !anchor) return;
    const originalMax = parseFloat(getComputedStyle(node).maxHeight) || Infinity;
    const originalWidth = node.offsetWidth || 320;
    const trigger = anchor;
    const close = () => dismissAction.current ? dismissAction.current() : trigger.click();
    escapeAction.current = () => { close(); trigger.focus(); };
    let frame = 0;
    const place = () => {
      const viewport = window.visualViewport;
      const topEdge = (viewport?.offsetTop || 0) + 12;
      const leftEdge = (viewport?.offsetLeft || 0) + 12;
      const width = (viewport?.width || window.innerWidth) - 24;
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 24;
      const rect = trigger.getBoundingClientRect();
      const classes = props.className || '';
      const matchWidth = /\bw-full\b/.test(classes) || (/left-\d.*right-\d/.test(classes) && !/\bw-(\d|\[)/.test(classes));
      node.style.minWidth = '0';
      node.style.width = `${Math.min(matchWidth ? rect.width : originalWidth, width)}px`;
      node.style.maxHeight = `${Math.min(originalMax, bottomEdge - topEdge)}px`;
      const height = node.offsetHeight;
      const below = bottomEdge - rect.bottom - 8;
      const above = rect.top - topEdge - 8;
      const opensAbove = below < height && above > below;
      const available = Math.max(0, opensAbove ? above : below);
      // Very short viewports use a scrollable panel instead of a clipped calendar.
      if (available >= 160) node.style.maxHeight = `${Math.min(originalMax, available, bottomEdge - topEdge)}px`;
      const alignedLeft = /right-0/.test(props.className || '') && !/left-0/.test(props.className || '') ? rect.right - node.offsetWidth : rect.left;
      node.style.left = `${Math.max(leftEdge, Math.min(alignedLeft, leftEdge + width - node.offsetWidth))}px`;
      node.style.top = `${Math.max(topEdge, Math.min(opensAbove ? rect.top - node.offsetHeight - 8 : rect.bottom + 8, bottomEdge - node.offsetHeight))}px`;
      node.style.visibility = 'visible';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); });
    };
    const trackScroll = (event: Event) => {
      // Position in the scroll event itself; scrolling options must not reposition their menu.
      if (event.target instanceof Node && node.contains(event.target)) return;
      place();
    };
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!trigger.contains(target) && !target.closest('[data-floating-panel]')) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && Array.from(document.querySelectorAll('[data-floating-panel]')).at(-1) === node) {
        event.preventDefault(); event.stopImmediatePropagation(); close(); trigger.focus();
      }
    };
    place();
    const observer = new ResizeObserver(schedule);
    observer.observe(trigger); observer.observe(node);
    window.addEventListener('scroll', trackScroll, true);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', trackScroll);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('scroll', trackScroll, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', trackScroll);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
    };
  }, [props.className]);
  useLayoutEffect(() => {
    if (animateEntrance) return animateUiEntrance(panel.current);
  }, [animateEntrance]);
  return <><span ref={marker} hidden />{createPortal(<div {...props} ref={panel} data-floating-panel data-ui-motion={animateEntrance ? 'menu' : 'none'}
    onMouseDown={event => { event.stopPropagation(); props.onMouseDown?.(event); }}
    onClick={event => { event.stopPropagation(); props.onClick?.(event); }}
    onKeyDown={event => { props.onKeyDown?.(event); if (event.key === 'Escape') { event.stopPropagation(); escapeAction.current(); } }}
    style={{ ...style, position: 'fixed', zIndex: 30000, margin: 0, right: 'auto', bottom: 'auto', visibility: 'hidden', overflowY: 'auto' }}>{children}</div>, document.body)}</>;
}
