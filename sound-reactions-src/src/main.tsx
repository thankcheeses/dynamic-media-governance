import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import './x.css'
import App from './App.tsx'

// Static hosts without an SPA fallback (e.g. a single hosted page) build with
// VITE_HASH_ROUTER=1 so deep links resolve as /#/route instead of 404ing.
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
