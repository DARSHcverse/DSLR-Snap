import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Keep the startup logo up long enough to read, even when the app loads instantly.
const SPLASH_MIN_MS = 1800
const splash = document.getElementById('splash')
if (splash) {
  setTimeout(() => {
    splash.classList.add('hide')
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  }, Math.max(0, SPLASH_MIN_MS - performance.now()))
}
