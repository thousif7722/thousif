import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { store } from './store';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
      .catch((err) => console.error('PWA Service Worker registration failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* ErrorBoundary: catches any JS crash and shows friendly retry UI */}
    <ErrorBoundary>
      <Provider store={store}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-center"
            gutter={8}
            toastOptions={{
              duration: 3500,
              style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif', fontSize: '14px', maxWidth: '420px' },
              success: { style: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' } },
              error: { style: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' } },
            }}
          />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

