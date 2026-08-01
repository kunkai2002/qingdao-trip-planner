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
/* Last, and deliberately so: the workspace is opaque content sitting beside the
   map, and several of its rules exist to take a surface *back* from glass.css.
   Same specificity, so source order is the whole mechanism. */
import './styles/workspace.css'
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
