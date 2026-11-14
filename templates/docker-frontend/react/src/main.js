import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './style.css';

createRoot(document.querySelector('#app')).render(createElement(App));
