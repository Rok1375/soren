import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-tactical-panel px-4 text-white">
          <div className="noise-overlay absolute inset-0" />
          <div className="relative z-10 flex max-w-md flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-tactical-amber/30 bg-tactical-amber/10">
              <AlertTriangle className="text-tactical-amber" size={32} />
            </div>
            
            <h1 className="mb-2 text-2xl font-bold uppercase tracking-tight">Something Went Wrong</h1>
            
            <p className="mb-6 text-sm leading-relaxed text-white/70">
              The app encountered an unexpected error. This can happen due to a temporary glitch.
            </p>
            
            {this.state.error && (
              <details className="mb-6 w-full overflow-hidden rounded-lg border border-white/10 bg-black/30">
                <summary className="cursor-pointer px-4 py-2 text-xs font-mono uppercase tracking-wider text-white/50 hover:bg-white/5">
                  Error Details
                </summary>
                <div className="max-h-48 overflow-auto px-4 py-3 font-mono text-xs text-tactical-red">
                  <p className="mb-2 font-bold">{this.state.error.toString()}</p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="whitespace-pre-wrap text-white/60">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            
            <button
              onClick={this.handleReload}
              className="touch-manipulation flex items-center gap-2 rounded-xl border border-tactical-green/50 bg-tactical-green px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.18em] text-black transition active:scale-[0.98]"
            >
              <RefreshCw size={18} />
              Reload App
            </button>
            
            <p className="mt-4 text-xs text-white/40">
              Your channel settings are saved locally
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
