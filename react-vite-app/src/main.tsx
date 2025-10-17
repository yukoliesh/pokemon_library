import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker in production only
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.MODE === 'production') {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((error) => {
          console.error('Service worker registration failed:', error)
        })
    }
  })
}
