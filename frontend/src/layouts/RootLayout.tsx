import { Outlet } from 'react-router-dom'
import { CookieConsentBanner } from '../components/CookieConsentBanner'
import { DesignPreviewBanner } from '../components/DesignPreviewBanner'
import { PreviewBanner } from '../components/PreviewBanner'
import { CartDrawer } from '../components/bold/CartDrawer'
import { BoldMobileBar } from '../components/layout/BoldMobileBar'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'
import { useTheme } from '../context/ThemeContext'

export function RootLayout() {
  const { preset } = useTheme()
  return (
    <div className="flex min-h-svh flex-col">
      <DesignPreviewBanner />
      <PreviewBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {preset === 'bold' && <BoldMobileBar />}
      {preset === 'bold' && <CartDrawer />}
      <CookieConsentBanner />
    </div>
  )
}
