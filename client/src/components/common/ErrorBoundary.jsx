import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-red-50 p-6 rounded-full mb-6">
            <AlertCircle className="w-16 h-16 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Oops! Something went wrong.
          </h1>
          <p className="text-red-600 max-w-2xl mb-4 font-mono text-xs text-left bg-red-50 p-4 rounded-xl overflow-auto h-48 border border-red-200">
            {this.state.error && this.state.error.toString()}
            <br/><br/>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg active:scale-95"
          >
            <RefreshCw className="w-5 h-5" />
            Back to Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
