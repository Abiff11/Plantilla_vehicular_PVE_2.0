import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

type ErrorBoundaryProps = PropsWithChildren<{
  fallback?: ReactNode;
}>;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-card">
            <p className="eyebrow">Error inesperado</p>
            <h2>Algo salió mal al cargar esta sección</h2>
            <p>
              La aplicación encontró un error al intentar mostrar el contenido.
              Puedes intentar recargar la página.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Detalles técnicos</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <div className="error-boundary-actions">
              <button className="primary-button" type="button" onClick={() => window.location.reload()}>
                Recargar página
              </button>
              <button className="ghost-button" type="button" onClick={this.handleReset}>
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

