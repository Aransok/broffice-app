import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { primeCsrfCookie } from './api/client'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { CookieConsentProvider } from './context/CookieConsentContext'
import { ThemeProvider } from './context/ThemeContext'
import { VatProvider } from './context/VatContext'
import { router } from './router'

const queryClient = new QueryClient()

void primeCsrfCookie()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
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
  </StrictMode>,
)
