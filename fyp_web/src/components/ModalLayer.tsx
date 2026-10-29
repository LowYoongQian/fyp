import type { HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

/** Dialog backdrops must not inherit a page's transform or overflow clipping. */
export function ModalLayer({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return createPortal(<div {...props} style={{ ...props.style, zIndex: 10000, overflowY: 'auto' }} data-modal-layer>{children}</div>, document.body);
}
