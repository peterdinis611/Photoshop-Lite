import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from '../pages/ErrorPage';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors and shows the darkroom error plate. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PhotoshopLite] Uncaught render error:', error, info.componentStack);
  }

  resetError = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return <ErrorPage error={this.state.error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}
