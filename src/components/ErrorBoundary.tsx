import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error || '');
    let friendly = raw || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.operationType) {
        friendly = `Cloud Archive (${parsed.operationType} on ${parsed.path || 'database'}): ${parsed.error}`;
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, errorMessage: friendly };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] text-[#241B1C] flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-[#FFFFFF] border border-[#EAE1D9] rounded-2xl p-8 space-y-4 shadow-sm">
            <p className="text-xs font-mono uppercase tracking-widest text-[#C83E0B]">
              The Truth About Love · Recovery Notice
            </p>
            <h1 className="text-xl font-serif-book font-bold text-[#0B0B0C]">
              Something interrupted the manuscript view
            </h1>
            <p className="text-xs text-[#5F6368] leading-relaxed break-words font-mono bg-[#F8F9FA] p-3 rounded-xl">
              {this.state.errorMessage}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-[#C83E0B] hover:bg-[#A93207] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Reload Manuscript
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
