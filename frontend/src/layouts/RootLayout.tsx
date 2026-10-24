import { Outlet } from 'react-router-dom'
import { CookieConsentBanner } from '../components/CookieConsentBanner'
import { DesignPreviewBanner } from '../components/DesignPreviewBanner'
import { PreviewBanner } from '../components/PreviewBanner'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'

export function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <DesignPreviewBanner />
      <PreviewBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieConsentBanner />
    </div>
  )
}
