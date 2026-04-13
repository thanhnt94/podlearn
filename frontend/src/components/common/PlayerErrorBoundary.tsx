import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class PlayerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Player Uncaught Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-red-500/10">
                <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Sync Disrupted</h2>
            <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
                The neural link encountered an unexpected exception while manifesting this session.
                <br/>
                <span className="text-[10px] opacity-30 font-mono mt-2 block">{this.state.error?.message}</span>
            </p>
            
            <button 
                onClick={this.handleReset}
                className="group flex items-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-sky-500 transition-all active:scale-95 shadow-xl"
            >
                <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                Reconnect Session
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}
