import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RestrictedPage } from './pages/Restricted';
import './styles/theme.css';
import './styles/components.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RestrictedPage />
  </StrictMode>
);
