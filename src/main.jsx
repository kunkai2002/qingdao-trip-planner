import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Order matters: tokens define the vocabulary, glass defines the material,
   base defines layout. Layout must be able to override material — e.g.
   `.panel { position: absolute }` has to beat `.glass { position: relative }`,
   and both are single-class selectors, so only source order decides. */
import './styles/tokens.css'
import './styles/glass.css'
import './styles/base.css'
import './styles/leaflet-theme.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

/* Registered after load so it never competes with first paint. Only in a real
   build: under `vite dev` the worker would serve stale modules and make HMR
   behave bizarrely. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* an unavailable worker only costs offline support and the install
         prompt — it must never break the page */
    })
  })
}
