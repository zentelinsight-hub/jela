import { Seo } from '../components/Seo'

const privacySections = [
  {
    title: '1. Scope of this policy',
    body: <><p>This Privacy Policy explains how Zentel Insight handles information for the public Jela AI website and Android service. Jela AI is a product powered by Zentel Insight.</p><p>The public website provides information, documentation and the official Android download; account creation, sign-in and the personal AI workspace are provided inside the Android application.</p></>,
  },
  {
    title: '2. Information you provide',
    body: <><p>If you contact us by email, phone or WhatsApp, we receive the information you choose to provide. Do not send passwords, verification codes or private credentials.</p><p>In the application, Jela stores profile and security state, conversations, preferences, selected Memory, Projects, private workspace files and extracted sections, generated images, devices, notifications, usage, subscription and billing records needed to operate your account.</p></>,
  },
  {
    title: '3. Technical information',
    body: <p>Hosting and security services may process standard technical information needed to deliver and protect the website, such as request times, browser or device details, approximate network information and security events. The exact data available depends on the infrastructure in use.</p>,
  },
  {
    title: '4. How information is used',
    body: <ul><li>Respond to enquiries and provide requested support.</li><li>Operate, secure and improve the website and future Jela AI service.</li><li>Publish and protect official Android release information.</li><li>Meet applicable legal obligations and address misuse.</li></ul>,
  },
  {
    title: '5. Service providers and disclosure',
    body: <p>We may use infrastructure and technology providers to operate Jela AI. They may process information on our behalf under their terms and applicable arrangements. We may also disclose information where required by law, to protect rights and safety, or in connection with a legitimate organisational transaction.</p>,
  },
  {
    title: '6. Retention and security',
    body: <p>Workspace data persists so it can synchronize after sign-in on another verified device. The app provides deletion controls for conversations, Memory, files and images. Permanent account deletion removes private workspace storage and application records before deleting authentication access, after required verification and subscription cancellation. Security and billing records may be retained where necessary for fraud prevention, disputes or legal obligations. No method of storage or transmission can be guaranteed completely secure.</p>,
  },
  {
    title: '7. Your choices',
    body: <p>You can turn Memory or automatic remembering off, edit or forget individual memories, clear Memory without deleting chats, remove workspace files and images, delete individual conversations, remove notification registrations and request permanent account deletion in the app. You may also contact us with a privacy request; we may need to verify identity before acting.</p>,
  },
  {
    title: '8. Children',
    body: <p>Jela AI is not presented as a service directed specifically to young children. Parents, guardians and educational institutions should supervise use appropriate to the user's age and context. More specific age requirements may accompany the application release.</p>,
  },
  {
    title: '9. Changes and contact',
    body: <p>We may update this policy as the product and legal requirements develop. Material revisions will be reflected by the date on this page. Questions can be sent to <a href="mailto:zentelinsight@gmail.com">zentelinsight@gmail.com</a> or raised by phone/WhatsApp at <a href="tel:+2347060833927">+234 706 083 3927</a>.</p>,
  },
]

const termsSections = [
  {
    title: '1. Acceptance and scope',
    body: <p>These Terms of Use apply to your access to the Jela AI public website and any official downloads made available through it. By using the website, you agree to these terms. Separate or updated terms may apply to the Android application when released.</p>,
  },
  {
    title: '2. Product status',
    body: <p>Jela AI is under active development. Website descriptions may identify planned or future capabilities. A planned capability is not a promise that it is currently available or will be released on a particular date.</p>,
  },
  {
    title: '3. Official Android releases',
    body: <p>Only APKs presented as current on the official Jela AI download page should be treated as official public releases. You are responsible for reviewing device prompts and compatibility information. Do not redistribute a modified build as an official Jela AI application.</p>,
  },
  {
    title: '4. Acceptable use',
    body: <><p>You must not misuse the website, interfere with its operation, attempt unauthorised access, distribute malware, misrepresent affiliation with Jela AI or Zentel Insight, or use the service in violation of applicable law or another person's rights.</p><p>You must not attempt to obtain or expose secrets, credentials or protected systems through the website.</p></>,
  },
  {
    title: '5. AI output and important decisions',
    body: <p>When AI capabilities become available, output may be incomplete, inaccurate or unsuitable for your circumstances. You remain responsible for evaluating output and for decisions you make. Do not rely on AI output as a substitute for qualified medical, legal, financial or other professional advice.</p>,
  },
  {
    title: '6. Intellectual property',
    body: <p>The Jela AI and Zentel Insight names, logos, website materials and software are protected by applicable intellectual-property rules. These terms do not transfer ownership. Third-party materials remain subject to their respective rights and terms.</p>,
  },
  {
    title: '7. Availability and changes',
    body: <p>We may change, suspend or discontinue website content or product functionality as the service develops. We do not guarantee uninterrupted availability. We will aim to communicate official release information accurately.</p>,
  },
  {
    title: '8. Disclaimers and responsibility',
    body: <p>To the extent permitted by applicable law, the website is provided on an “as available” basis without fabricated performance or accuracy guarantees. Nothing in these terms excludes responsibility that cannot lawfully be excluded.</p>,
  },
  {
    title: '9. Contact and updates',
    body: <p>We may update these terms as Jela AI develops. The date shown on this page identifies the latest published version. Questions may be sent to <a href="mailto:zentelinsight@gmail.com">zentelinsight@gmail.com</a> or raised at <a href="tel:+2347060833927">+234 706 083 3927</a>.</p>,
  },
]

export default function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  const privacy = type === 'privacy'
  const title = privacy ? 'Privacy Policy' : 'Terms of Use'
  const description = privacy
    ? 'How Zentel Insight handles information for the Jela AI website and developing product.'
    : 'The terms governing use of the Jela AI website and official Android releases.'
  const sections = privacy ? privacySections : termsSections

  return (
    <main className="legal-page">
      <Seo title={title} description={description} path={privacy ? '/privacy' : '/terms'} />
      <header className="legal-header">
        <div className="container legal-header__inner">
          <p className="eyebrow">Legal</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <span>Effective August 13, 2026</span>
        </div>
      </header>
      <div className="container legal-layout">
        <aside>
          <p>Contents</p>
          <nav>{sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{section.title}</a>)}</nav>
        </aside>
        <article>
          <div className="legal-notice">This document is written in plain language to describe the current website and Android personal-workspace data practices.</div>
          {sections.map((section, index) => (
            <section key={section.title} id={`section-${index + 1}`}>
              <h2>{section.title}</h2>
              {section.body}
            </section>
          ))}
        </article>
      </div>
    </main>
  )
}
