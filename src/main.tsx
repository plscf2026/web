import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

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

