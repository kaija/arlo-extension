import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Options } from './Options';
import './options.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
