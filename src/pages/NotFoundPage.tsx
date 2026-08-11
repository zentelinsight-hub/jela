import { ArrowLeft } from 'lucide-react'
import { ButtonLink } from '../components/ButtonLink'
import { Seo } from '../components/Seo'

export default function NotFoundPage() {
  return (
    <main className="not-found">
      <Seo title="Page not found" description="The requested Jela AI page could not be found." path={window.location.pathname} />
      <div className="not-found__mark" aria-hidden="true">404</div>
      <p className="eyebrow">Page not found</p>
      <h1>This path does not lead anywhere yet.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <ButtonLink href="/" variant="neutral"><ArrowLeft size={18} />Back to home</ButtonLink>
    </main>
  )
}
