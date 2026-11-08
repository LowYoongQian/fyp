import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MotionConfig } from 'motion/react'

// Reset links emailed before the reset page existed point at "/?reset_token=…"; "/" is the public page now, so they open the reset page.
const legacyResetToken = new URLSearchParams(window.location.search).get('reset_token')
if (legacyResetToken) window.history.replaceState({}, '', `/login/reset?token=${encodeURIComponent(legacyResetToken)}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
