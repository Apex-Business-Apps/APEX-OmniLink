import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TermsPage } from './pages/Terms';
import './styles/theme.css';
import './styles/components.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TermsPage />
  </StrictMode>
);
