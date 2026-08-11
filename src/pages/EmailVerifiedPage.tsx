import { CheckCircle2, CircleAlert, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Seo } from '../components/Seo'
import { webSupabase } from '../lib/supabase'

type State = 'working' | 'success' | 'error'

export default function EmailVerifiedPage() {
  const initialParams = new URLSearchParams(window.location.search)
  const initiallyValid = Boolean(webSupabase && (initialParams.get('code') || initialParams.get('token_hash')) && !initialParams.get('error'))
  const [state, setState] = useState<State>(initiallyValid ? 'working' : 'error')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const tokenHash = params.get('token_hash')
    const type = params.get('type')
    if (!webSupabase || (!code && !tokenHash) || params.get('error')) return
    const confirm = code
      ? webSupabase.auth.exchangeCodeForSession(code)
      : webSupabase.auth.verifyOtp({ token_hash: tokenHash!, type: type === 'recovery' ? 'recovery' : 'email' })
    confirm.then(({ error }) => setState(error ? 'error' : 'success')).catch(() => setState('error'))
  }, [])
  return <main className="callback-page"><Seo title="Verify your email" description="Secure Jela AI email verification." path="/email-verified" noIndex /><section className="status-panel" aria-live="polite">
    {state === 'working' ? <><MailCheck /><h1>Verifying your email</h1><p>Please keep this page open for a moment.</p></> : state === 'success' ? <><CheckCircle2 /><h1>Email verified</h1><p>Your Jela AI account is ready. Return to the Android app and log in.</p></> : <><CircleAlert /><h1>Verification link unavailable</h1><p>This link may have expired or already been used. Request a new verification email from the Jela AI app.</p></>}
  </section></main>
}
