import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {StatusBar, Style} from '@capacitor/status-bar';
import App from './App.tsx';
import './index.css';

// Android targets SDK 36 which forces edge-to-edge — without this, the WebView
// draws under the status bar and (combined with viewport-fit=cover) the system
// bars are visually missing. Inset the WebView below the status bar and give
// it the app's cream background so notification icons sit on a real surface.
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#F7F5F2' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
