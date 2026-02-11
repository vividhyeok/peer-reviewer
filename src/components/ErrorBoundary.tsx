import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-8 text-center text-zinc-800">
          <div className="bg-red-50 p-4 rounded-full mb-4">
            <AlertTriangle className="text-red-500 w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-zinc-600 max-w-md mb-8">
            An unexpected error occurred in the application.
          </p>
          
          <div className="bg-white border border-zinc-200 rounded p-4 mb-6 max-w-lg w-full overflow-auto text-left">
            <code className="text-xs text-red-600 font-mono block whitespace-pre-wrap">
              {this.state.error?.message}
            </code>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium shadow-sm hover:shadow"
          >
            <RefreshCcw size={16} />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
