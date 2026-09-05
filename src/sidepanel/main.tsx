import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { watchTheme } from '../shared/theme';
import { App } from './App';
import './styles.css';

// theme-boot.js already painted the stored theme; this keeps it current.
watchTheme();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
