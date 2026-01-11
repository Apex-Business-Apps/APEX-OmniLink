import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RequestAccessPage } from './pages/RequestAccess';
import './styles/theme.css';
import './styles/components.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RequestAccessPage />
  </StrictMode>
);
