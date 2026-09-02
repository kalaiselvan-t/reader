import '@fontsource/literata/400.css';
import '@fontsource/literata/600.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/600.css';
import './styles/tokens.css';
import './styles/global.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
