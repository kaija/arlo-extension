import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../sidepanel/styles.css';
import { Options } from './Options';
import './options.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
