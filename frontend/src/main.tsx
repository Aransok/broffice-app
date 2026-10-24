import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { primeCsrfCookie } from './api/client'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { DesignPreviewGate } from './components/DesignPreviewBanner'
import { CookieConsentProvider } from './context/CookieConsentContext'
import { ThemeProvider } from './context/ThemeContext'
import { VatProvider } from './context/VatContext'
import { initPreviewFromUrl } from './preview'
import { router } from './router'

const queryClient = new QueryClient()

initPreviewFromUrl()
void primeCsrfCookie()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <DesignPreviewGate />
            <VatProvider>
              <CartProvider>
                <CookieConsentProvider>
                  <RouterProvider router={router} />
                </CookieConsentProvider>
              </CartProvider>
            </VatProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>,
)
