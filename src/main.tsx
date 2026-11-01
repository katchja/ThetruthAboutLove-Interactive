import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
      typeof reason === 'string'
        ? reason
        : reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : '';
    // Suppress benign Vite HMR WebSocket / AbortError / clipboard iframe rejections
    if (
      msg.includes('WebSocket') ||
      msg.includes('vite-hmr') ||
      msg.includes('AbortError') ||
      msg.includes('NotAllowedError') ||
      msg.includes('The play() request was interrupted')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);

