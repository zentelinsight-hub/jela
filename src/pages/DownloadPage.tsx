import { AlertCircle, CheckCircle2, Copy, Download, FileCheck2, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ButtonLink } from '../components/ButtonLink'
import { PageIntro } from '../components/PageIntro'
import { Seo } from '../components/Seo'
import { formatFileSize, getCurrentAndroidRelease, type ReleaseResult } from '../lib/releases'

export default function DownloadPage() {
  const [result, setResult] = useState<ReleaseResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    getCurrentAndroidRelease().then((nextResult) => {
      if (active) setResult(nextResult)
    })
    return () => { active = false }
  }, [])

  const copyChecksum = async (checksum: string) => {
    await navigator.clipboard.writeText(checksum)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main>
      <Seo
        title="Download Jela AI"
        description="Get the official Jela AI Android APK, release details, checksum and clear installation guidance."
        path="/download"
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
                    <img src="/brand/jela-ai-logo.png" alt="" />
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
                {result.release.release_notes ? (
                  <div className="release-notes"><h3>Release notes</h3><p>{result.release.release_notes}</p></div>
                ) : null}
                {result.release.sha256 ? (
                  <div className="checksum">
                    <div><span>SHA-256 checksum</span><code>{result.release.sha256}</code></div>
                    <button type="button" onClick={() => copyChecksum(result.release.sha256!)} aria-label="Copy SHA-256 checksum">
                      <Copy size={17} />{copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : null}
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
                <p className="eyebrow eyebrow--green">Release preparation</p>
                <h2>Jela AI for Android is being prepared for release.</h2>
                <p>No public APK has been marked as current yet. When the verified build is ready, its version, file details, release notes and download action will appear here automatically.</p>
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
