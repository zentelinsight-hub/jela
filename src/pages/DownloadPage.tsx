import { AlertCircle, CheckCircle2, Download, FileCheck2, ShieldCheck, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { PageIntro } from '../components/PageIntro'
import { Seo } from '../components/Seo'
import { formatFileSize, getCurrentAndroidRelease, type ReleaseResult } from '../lib/releases'
import { webSupabase } from '../lib/supabase'
import { canonicalUrl } from '../lib/seo'

export default function DownloadPage() {
  const [result, setResult] = useState<ReleaseResult | null>(null)

  const refresh = useCallback(async () => {
    const nextResult = await getCurrentAndroidRelease()
    setResult(nextResult)
  }, [])

  useEffect(() => {
    let active = true
    getCurrentAndroidRelease().then((nextResult) => {
      if (active) setResult(nextResult)
    })
    if (!webSupabase) return () => { active = false }
    const channel = webSupabase.channel('website-current-android-release')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jela_ai_releases', filter: 'platform=eq.android' }, () => void refresh())
      .subscribe()
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { active = false; document.removeEventListener('visibilitychange', onVisibility); void webSupabase?.removeChannel(channel) }
  }, [refresh])

  const structuredData = useMemo(() => result?.status === 'available' ? {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Jela AI',
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Android',
    softwareVersion: result.release.version_name,
    datePublished: result.release.published_at,
    fileSize: result.release.file_size ? `${result.release.file_size} bytes` : undefined,
    downloadUrl: canonicalUrl('/download'),
    publisher: { '@type': 'Organization', name: 'Zentel Insight' },
  } : null, [result])

  return (
    <main>
      <Seo
        title="Download Jela AI"
        description="Get the official Jela AI Android APK with verified release details and clear installation guidance."
        path="/download"
        structuredData={structuredData}
      />
      <PageIntro
        eyebrow="Official Android distribution"
        title="Jela AI for Android"
        description="This is the official source for verified Jela AI Android releases from Zentel Insight. Always check the version details before installing."
      />

      <section className="section download-section">
        <div className="container download-grid">
          <div className="release-card">
            {result === null ? (
              <div className="release-state release-state--loading" aria-live="polite">
                <span className="page-loader__mark" aria-hidden="true" />
                <h2>Checking the current release</h2>
                <p>Confirming the latest Android version and integrity details.</p>
              </div>
            ) : result.status === 'available' ? (
              <div className="release-available" aria-live="polite">
                <div className="release-card__header">
                  <div className="app-identity">
                    <img src="/brand/jela-ai-mark.png" alt="" />
                    <div><span>Current release</span><h2>Jela AI {result.release.version_name}</h2></div>
                  </div>
                  <span className="verified-badge"><CheckCircle2 /> Verified metadata</span>
                </div>
                <dl className="release-metadata">
                  <div><dt>Version</dt><dd>{result.release.version_name}</dd></div>
                  <div><dt>Version code</dt><dd>{result.release.version_code}</dd></div>
                  <div><dt>Published</dt><dd>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(result.release.published_at))}</dd></div>
                  <div><dt>File size</dt><dd>{formatFileSize(result.release.file_size)}</dd></div>
                  <div><dt>Minimum supported version</dt><dd>{result.release.minimum_supported_version ?? 'Not specified'}</dd></div>
                </dl>
                <ButtonLink href={result.downloadUrl} external download variant="success" className="release-download">
                  <Download size={20} />Download APK
                </ButtonLink>
              </div>
            ) : result.status === 'error' ? (
              <div className="release-state" role="status">
                <span className="release-state__icon release-state__icon--error"><AlertCircle /></span>
                <h2>Release information is temporarily unavailable.</h2>
                <p>We could not confirm the current Android release. Please try again later or contact Zentel Insight before downloading Jela AI from another source.</p>
                <ButtonLink href="/contact" variant="neutral">Contact the team</ButtonLink>
              </div>
            ) : (
              <div className="release-state" role="status">
                <span className="release-state__icon"><Smartphone /></span>
                <p className="eyebrow eyebrow--green">Official release status</p>
                <h2>No verified public Android release is available right now.</h2>
                <p>This page will update automatically as soon as Zentel Insight marks a tested APK as the current official release.</p>
                <ButtonLink href="/docs/getting-started" variant="neutral">Read getting started</ButtonLink>
              </div>
            )}
          </div>

          <aside className="installation-card">
            <p className="eyebrow">Install with confidence</p>
            <h2>Before you install</h2>
            <ol className="installation-steps">
              <li><span>1</span><div><strong>Download from this page</strong><p>Use only the current official release shown here.</p></div></li>
              <li><span>2</span><div><strong>Review Android's prompt</strong><p>Your device may ask you to allow installation from your browser or file manager.</p></div></li>
              <li><span>3</span><div><strong>Complete the installation</strong><p>Open the downloaded APK and follow the device instructions.</p></div></li>
            </ol>
            <div className="security-note">
              <ShieldCheck aria-hidden="true" />
              <p><strong>A normal Android safeguard</strong>Direct APK distribution happens outside Google Play, so Android may request one-time permission for your chosen source.</p>
            </div>
            <div className="source-note"><FileCheck2 /><span>Official publisher<br /><strong>Zentel Insight</strong></span></div>
          </aside>
        </div>
      </section>
    </main>
  )
}
