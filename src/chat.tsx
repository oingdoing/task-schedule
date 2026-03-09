import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatPage from './pages/ChatPage';
import './styles.css';
import './chat.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatPage />
  </React.StrictMode>,
);
