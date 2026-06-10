import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = "dashboard";
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
              <span className="text-3xl">⚠️</span>
            </div>

            <h1 className="text-2xl font-extrabold text-slate-100 mb-3 tracking-tight">
              Something went wrong
            </h1>
            
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              An unexpected error occurred in the application. You can attempt to reload the dashboard or contact support if the issue persists.
            </p>

            {this.state.error && (
              <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6 max-h-32 overflow-auto text-xs font-mono text-rose-300">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
