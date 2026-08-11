import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { PageLoader } from './components/PageLoader'

const HomePage = lazy(() => import('./pages/HomePage'))
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'))
const DownloadPage = lazy(() => import('./pages/DownloadPage'))
const DocsHomePage = lazy(() => import('./pages/DocsHomePage'))
const DocsArticlePage = lazy(() => import('./pages/DocsArticlePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const EmailVerifiedPage = lazy(() => import('./pages/EmailVerifiedPage'))
const PaymentReturnPage = lazy(() => import('./pages/PaymentReturnPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function RouteEffects() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <RouteEffects />
      <div className="site-shell">
        <Header />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/email-verified" element={<EmailVerifiedPage />} />
            <Route path="/payment-return" element={<PaymentReturnPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/docs" element={<DocsHomePage />} />
            <Route path="/docs/:article" element={<DocsArticlePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/privacy" element={<LegalPage type="privacy" />} />
            <Route path="/terms" element={<LegalPage type="terms" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
