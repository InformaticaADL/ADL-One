import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from '../../pages/ErrorPage';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorPage 
            code="Crash" 
            title="¡Ups! Algo falló" 
            message={this.state.error?.message || 'Se ha detectado un error crítico en esta sección de la aplicación.'} 
            resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
