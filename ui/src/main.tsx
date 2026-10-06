import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import css from './index.css?inline'
import sonnerCss from 'sonner/dist/styles.css?inline'
import { root } from './lib/root'
import App from './App.tsx'

const FONTES = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
const cfg = (window as unknown as { CRONOGRAMA_EAD?: { fontes?: boolean } }).CRONOGRAMA_EAD
if (cfg?.fontes !== false && !document.querySelector('link[data-ce-fontes]') && !document.querySelector('link[href*="IBM+Plex+Sans"]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTES; l.setAttribute('data-ce-fontes', ''); document.head.appendChild(l)
}

// No WordPress o sistema vive num shadow DOM: o visual dele não vaza para o tema, nem o do tema para ele.
const host = document.getElementById('cronograma-ead-app')
let mount: HTMLElement
if (host) {
  const sh = host.attachShadow({ mode: 'open' })
  const st = document.createElement('style'); st.textContent = sonnerCss + css; sh.appendChild(st)
  mount = document.createElement('div'); sh.appendChild(mount)
} else {
  const st = document.createElement('style'); st.textContent = sonnerCss + css; document.head.appendChild(st)
  mount = document.getElementById('root')!
}
mount.classList.add('ce-root')
root.el = mount

createRoot(mount).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
