import { CheckCircle2, KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Seo } from '../components/Seo'
import { canonicalUrl } from '../lib/seo'
import { webSupabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null)
    if (!webSupabase) { setError('Password reset is temporarily unavailable. Please try again shortly.'); return }
    setLoading(true)
    const { error: resetError } = await webSupabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: canonicalUrl('/reset-password') })
    setLoading(false)
    if (resetError) setError('We could not send the reset link right now. Check your connection and try again.')
    else setSent(true)
  }
  return <main className="callback-page auth-page"><Seo title="Forgot password" description="Request a secure Jela AI password reset link." path="/forgot-password" noIndex />
    <section className="status-panel auth-panel" aria-live="polite">{sent ? <><CheckCircle2 /><p className="eyebrow">Check your email</p><h1>Reset link sent</h1><p>If an account exists for that address, we&apos;ve sent a password reset link.</p></> : <><KeyRound /><p className="eyebrow">Account recovery</p><h1>Forgot your password?</h1><p>Enter the email address connected to your Jela AI account.</p><form className="auth-form" onSubmit={submit}><label htmlFor="reset-email">Email address</label><div className="auth-input"><Mail size={18} /><input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@domain.com" /></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button button--success" disabled={loading}>{loading ? 'Sending reset link…' : 'Send reset link'}</button></form></>}</section>
  </main>
}
