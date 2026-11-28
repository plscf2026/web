import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Auto-recover once when a new deployment invalidates cached lazy-loaded chunk hashes
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    const reloadKey = 'plscf_chunk_reload_at';
    const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
    if (!lastReload || Date.now() - lastReload > 15_000) {
      event.preventDefault();
      sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary
    fallbackTitle="Police Lines School & College, Faridpur"
    fallbackMessage="পৃষ্ঠাটি লোড করতে একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পৃষ্ঠাটি রিলোড দিন।"
    showHomeButton
    onNavigateHome={() => window.location.reload()}
  >
    <App />
  </ErrorBoundary>
);

