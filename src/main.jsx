import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import router from './routes/index.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import { preventClickjacking } from './utils/security.js'

// Security: Prevent clickjacking on app load
preventClickjacking();

// Security: Disable console in production (optional)
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // Keep console.error for critical errors
}

// Security: Prevent opening new windows/tabs with sensitive data
window.addEventListener('beforeunload', (e) => {
  // Clear sensitive data before unload
  // This is handled by sessionStorage automatically
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
)
