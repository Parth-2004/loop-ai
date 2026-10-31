import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { initMotion } from './motion.js';
import { installInteractions } from './interactions.js';
import './styles.css';
import './app-fx.css';

initMotion();
installInteractions();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
