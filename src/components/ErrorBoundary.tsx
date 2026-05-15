import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ReadQuest] uncaught render error:", error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="boot-screen">
          <div className="boot-card" role="alert">
            <div className="brand-mark" aria-hidden="true" style={{ animation: "none" }}>
              <RefreshCw />
            </div>
            <h1>Something went wrong</h1>
            <p>ReadQuest hit an unexpected error. Reloading usually clears it.</p>
            <button className="primary-button" type="button" onClick={this.handleReload}>
              Reload app
            </button>
            <details style={{ marginTop: "var(--space-4)", fontSize: "var(--text-xs)", opacity: 0.7 }}>
              <summary>Error details</summary>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: "var(--space-2)" }}>
                {this.state.error.message}
              </pre>
            </details>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
