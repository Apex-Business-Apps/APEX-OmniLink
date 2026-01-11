import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TechSpecsPage } from './pages/TechSpecs';
import './styles/theme.css';
import './styles/components.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TechSpecsPage />
  </StrictMode>
);
