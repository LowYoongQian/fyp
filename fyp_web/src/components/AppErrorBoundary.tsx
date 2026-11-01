import { Component, type ReactNode } from 'react';
import { ErrorPage } from '../pages/public/ErrorPage';

/**
 * The last safety net: if any page crashes while drawing (or a page's code cannot be loaded, as after a new deployment), the visitor sees the
 * 500 error page with Try again instead of a blank screen. Nothing is sent anywhere; the details go to the browser console only.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('A page failed to draw:', error);
  }

  render() {
    return this.state.failed ? <ErrorPage code={500} /> : this.props.children;
  }
}
