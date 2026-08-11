import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Seo } from '../components/Seo'

export default function PaymentReturnPage() {
  const reference = useMemo(() => new URLSearchParams(window.location.search).get('reference') ?? new URLSearchParams(window.location.search).get('trxref'), [])
  const appUrl = reference ? `jela://payment-return?reference=${encodeURIComponent(reference)}` : 'jela://payment-return'
  useEffect(() => { if (reference) window.setTimeout(() => { window.location.href = appUrl }, 350) }, [appUrl, reference])
  return <main className="callback-page"><Seo title="Confirming payment" description="Return securely to Jela AI after Paystack checkout." path="/payment-return" noIndex /><section className="status-panel" aria-live="polite">
    <LoaderCircle className="spin" /><h1>{reference ? 'Returning to Jela AI' : 'Payment reference missing'}</h1>
    <p>{reference ? 'The app will verify this payment with Jela AI’s backend. This page does not activate a plan by itself.' : 'Return to the Jela AI app and review your billing history. No plan change was made from this page.'}</p>
    {reference ? <a className="button button--success" href={appUrl}>Open Jela AI</a> : null}<div className="callback-trust"><ShieldCheck />Server verification required</div>
  </section></main>
}
