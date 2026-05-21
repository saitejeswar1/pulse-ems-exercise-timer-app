import { useState, useEffect } from 'react';
import { Download, Monitor, Share, CornerRightDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    // Check if we are already running standalone (already installed)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent original mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If prompt isn't supported, show visual instructions
      setShowTip(true);
      return;
    }

    // Show the native browser install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    // Clear the deferred prompt variable, it can only be used once
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return null; // hide if already running as an app
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <motion.button
        id="btn-install-app"
        onClick={handleInstallClick}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between p-4 bg-natural-moss/10 hover:bg-natural-moss/20 text-natural-moss border border-natural-moss/30 rounded-xl transition duration-150 cursor-pointer text-left shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-natural-moss/15 rounded-lg text-natural-moss">
            <Download className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-natural-dark">Save Pulse as an Android App</div>
            <div className="text-xs text-[#70706B]">Run exercises offline with wake lock instantly</div>
          </div>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 bg-white border border-natural-border rounded-md text-natural-moss uppercase tracking-wider">
          {deferredPrompt ? 'INSTALL' : 'SETUP'}
        </div>
      </motion.button>

      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-white border border-natural-border rounded-xl flex flex-col gap-2.5 text-xs text-[#757570]"
          >
            <div className="font-semibold text-natural-dark flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-natural-terracotta"></span>
              How to install manual app on Android:
            </div>
            <ol className="list-decimal list-inside space-y-1.5 bg-natural-bg p-2.5 rounded-lg border border-natural-border">
              <li>Open this page in <strong className="text-natural-dark">Google Chrome</strong> on your phone.</li>
              <li>Tap the browser menu button (<strong className="text-natural-dark">⋮</strong>) in the top-right.</li>
              <li>Select <strong className="text-natural-dark">"Add to Home screen"</strong> or <strong className="text-natural-dark">"Install app"</strong>.</li>
              <li>Once installed, open <strong className="text-natural-moss">Pulse</strong> directly from your apps grid.</li>
            </ol>
            <button 
              onClick={() => setShowTip(false)}
              className="text-right text-natural-terracotta font-semibold hover:underline mt-1 cursor-pointer"
            >
              Dismiss Setup Instructions
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
