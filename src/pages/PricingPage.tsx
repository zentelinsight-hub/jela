import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageIntro } from '../components/PageIntro'
import { Seo } from '../components/Seo'
import { webSupabase } from '../lib/supabase'

type Plan = { id: string; code: string; name: string; description: string | null; currency: string; price_minor: number; interval: string; features: string[]; most_popular: boolean; purchasable: boolean }

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState(!webSupabase)
  const refresh = useCallback(async () => {
    if (!webSupabase) return
    const { data, error: queryError } = await webSupabase.from('jela_public_plans').select('*').order('sort_order')
    if (queryError) setError(true)
    else { setPlans((data ?? []) as Plan[]); setError(false) }
  }, [])
  useEffect(() => {
    if (!webSupabase) return
    queueMicrotask(() => void refresh())
    const channel = webSupabase.channel('website-public-plans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_plans' }, () => void refresh())
      .subscribe()
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { document.removeEventListener('visibilitychange', onVisibility); void webSupabase?.removeChannel(channel) }
  }, [refresh])
  return <main>
    <Seo title="Jela AI Plans" description="Compare current Jela AI plans and public features." path="/pricing" />
    <PageIntro eyebrow="Simple, authoritative plans" title="Choose how you use Jela AI" description="Prices and availability come directly from Jela AI's production plan service. Internal usage units are never displayed." />
    <section className="section"><div className="container">
      {!plans && !error ? <div className="page-loader"><span className="page-loader__mark" />Loading current plans</div> : error ? <div className="status-panel"><h2>Plans are temporarily unavailable</h2><p>Please return shortly. No placeholder prices are shown.</p></div> : <div className="pricing-grid">{plans?.map((plan) => <article className={`pricing-card ${plan.most_popular ? 'pricing-card--popular' : ''}`} key={plan.id}>
        {plan.most_popular ? <span className="verified-badge">Most popular</span> : null}<p className="eyebrow">{plan.name}</p>
        <h2>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }).format(plan.price_minor / 100)}<small> / {plan.interval}</small></h2>
        <p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 />{feature}</li>)}</ul>
        <p className="pricing-state">{plan.code === 'free' ? 'Included with every verified account.' : plan.purchasable ? 'Available securely inside the Jela AI Android app.' : 'Secure checkout is being prepared. No payment can be taken yet.'}</p>
      </article>)}</div>}
      <div className="pricing-security"><ShieldCheck /><p><strong>Payment integrity</strong><br />Paystack transactions are initialized and verified by Jela AI&apos;s backend. A browser callback alone never activates a plan.</p></div>
    </div></section>
  </main>
}
