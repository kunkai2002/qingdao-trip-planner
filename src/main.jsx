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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
