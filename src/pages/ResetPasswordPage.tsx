import { CheckCircle2, KeyRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Seo } from '../components/Seo'
import { webSupabase } from '../lib/supabase'

type State = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const [state, setState] = useState<State>(webSupabase ? 'checking' : 'invalid')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const supabase = webSupabase
    if (!supabase) return
    let active = true
    const establish = async () => {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) await supabase.auth.exchangeCodeForSession(code)
      const { data } = await supabase.auth.getSession()
      if (active) setState(data.session ? 'ready' : 'invalid')
    }
    void establish()
    const { data: listener } = supabase.auth.onAuthStateChange((event) => { if (active && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) setState('ready') })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null)
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) { setError('Use at least 8 characters with uppercase, lowercase and a number.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (!webSupabase) { setState('invalid'); return }
    setLoading(true)
    const { error: updateError } = await webSupabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) setError('This reset link is invalid or has expired. Request a new link and try again.')
    else { await webSupabase.auth.signOut(); setState('done') }
  }
  return <main className="callback-page auth-page"><Seo title="Reset password" description="Choose a new password for your Jela AI account." path="/reset-password" noIndex /><section className="status-panel auth-panel" aria-live="polite">
    {state === 'checking' ? <><span className="page-loader__mark" /><h1>Checking your reset link</h1><p>This will only take a moment.</p></> : state === 'invalid' ? <><KeyRound /><h1>Reset link unavailable</h1><p>This link is invalid, expired or already used. Request a new password reset email.</p><a className="button button--success" href="/forgot-password">Request a new link</a></> : state === 'done' ? <><CheckCircle2 /><h1>Password updated</h1><p>Your password has been updated successfully.</p><p>You can now close this tab and sign in to the Jela AI app with your new password.</p></> : <><KeyRound /><p className="eyebrow">Secure account recovery</p><h1>Reset your password</h1><form className="auth-form" onSubmit={submit}><label htmlFor="new-password">New password</label><input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /><p className="form-hint">At least 8 characters with uppercase, lowercase and a number.</p><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />{error ? <p className="form-error" role="alert">{error}</p> : null}<button className="button button--success" disabled={loading}>{loading ? 'Updating password…' : 'Update password'}</button></form></>}
  </section></main>
}
