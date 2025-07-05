import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ApartmentProvider } from './context/ApartmentContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ApartmentProvider>
          <App />
        </ApartmentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
