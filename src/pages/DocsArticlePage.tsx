import { AlertTriangle, ArrowRight, CheckCircle2, Info, Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DocsLayout } from '../components/DocsLayout'
import { Seo } from '../components/Seo'
import { docsNavigation } from '../data/content'
import NotFoundPage from './NotFoundPage'

type ArticleSection = {
  id: string
  title: string
  content: ReactNode
}

type Article = {
  title: string
  description: string
  updated: string
  sections: ArticleSection[]
}

const articles: Record<string, Article> = {
  'getting-started': {
    title: 'Getting Started',
    description: 'Understand the role of this website, the future Android application and the official release process.',
    updated: 'August 11, 2026',
    sections: [
      {
        id: 'what-is-jela', title: 'What Jela AI is', content: <>
          <p>Jela AI is an intelligent companion being built by Zentel Insight to help people learn, research, create and solve practical problems. The core product will be a native Android application.</p>
          <p>Jela is intended to support your thinking through conversation. You will be able to add context, ask follow-up questions and refine an answer as your goal becomes clearer.</p>
        </>,
      },
      {
        id: 'website-and-app', title: 'Website and application', content: <>
          <p>This public website introduces Jela, hosts documentation, publishes legal and contact information, and provides the official Android download. It does not contain a web-based chat, account dashboard or authentication flow.</p>
          <div className="docs-callout"><Info /><p><strong>Accounts belong in the app.</strong> Account creation, sign-in and application settings will be handled inside the native Jela AI application—not on this public website.</p></div>
        </>,
      },
      {
        id: 'official-download', title: 'Official Android download', content: <>
          <p>When a release is available, download the APK from the official <Link to="/download">Jela AI download page</Link>. The page will identify the current version and may include its file size, release notes, minimum supported version and SHA-256 checksum.</p>
          <p>The page reads the current release directly from Jela AI's production release service. It never presents a fabricated file or inactive download control.</p>
        </>,
      },
      {
        id: 'next-steps', title: 'Your next steps', content: <>
          <ol>
            <li>Review the current release status on the download page.</li>
            <li>Read the security and installation guidance before installing an APK.</li>
            <li>Use this documentation to understand product behaviour as capabilities are released.</li>
          </ol>
        </>,
      },
    ],
  },
  'account-and-security': {
    title: 'Account & Security',
    description: 'The intended application account model and practical ways to protect access to Jela AI.',
    updated: 'August 11, 2026',
    sections: [
      {
        id: 'account-model', title: 'Planned account model', content: <>
          <p>Jela AI accounts are planned for the native application. Authentication is not available on the public website. Exact sign-in methods will be documented after they are approved and implemented.</p>
          <p>Application access states may include active, restricted, suspended or deactivated. These states are intended to be scoped to Jela AI rather than unnecessarily affecting a person's access to other Zentel Insight services.</p>
        </>,
      },
      {
        id: 'protect-account', title: 'Protecting your account', content: <>
          <ul className="docs-check-list">
            <li><CheckCircle2 />Use a unique password when password access is supported.</li>
            <li><CheckCircle2 />Keep verification codes and recovery details private.</li>
            <li><CheckCircle2 />Install updates only from the official Jela AI download page.</li>
            <li><CheckCircle2 />Contact Zentel Insight if you notice unexpected access.</li>
          </ul>
        </>,
      },
      {
        id: 'website-safety', title: 'Website safety', content: <>
          <p>The Jela AI website will not ask you to sign in. A page claiming to be this website that requests your Jela password or verification code should be treated cautiously.</p>
          <div className="docs-callout docs-callout--warning"><AlertTriangle /><p><strong>Never share secret credentials.</strong> Zentel Insight will not ask you to email a password, verification code or private API key.</p></div>
        </>,
      },
    ],
  },
  'using-jela': {
    title: 'Using Jela AI',
    description: 'A practical guide to useful conversations, better context and responsible use.',
    updated: 'August 11, 2026',
    sections: [
      {
        id: 'conversation-model', title: 'A conversation that builds', content: <>
          <p>Jela is intended to work through an ongoing conversation. Start with your goal, then add the context that would help a thoughtful collaborator understand what you need.</p>
          <p>You can ask for a simpler explanation, a more technical treatment, examples, counterarguments or a step-by-step approach. Follow-up questions help turn a broad first answer into something fitted to your work.</p>
        </>,
      },
      {
        id: 'write-prompts', title: 'Write a useful request', content: <>
          <div className="docs-callout"><Lightbulb /><p><strong>A useful pattern:</strong> explain the goal, include relevant context, name important constraints and say what a helpful result should look like.</p></div>
          <p>For example, instead of asking only for “help with biology,” explain the concept you are studying, your current level, what is confusing and whether you want a short explanation or a detailed walkthrough.</p>
        </>,
      },
      {
        id: 'common-uses', title: 'Common use cases', content: <>
          <ul>
            <li>Understanding and revising an academic concept.</li>
            <li>Planning a research question or project structure.</li>
            <li>Reasoning through a programming error.</li>
            <li>Improving clarity, tone or structure in a draft.</li>
            <li>Exploring options before making a practical decision.</li>
          </ul>
        </>,
      },
      {
        id: 'verify-output', title: 'Verify important output', content: <>
          <p>AI can produce plausible but incorrect information. Check important facts against reliable sources. For high-impact medical, legal, financial, safety or academic decisions, consult qualified people and authoritative material.</p>
        </>,
      },
    ],
  },
  'files-and-analysis': {
    title: 'Files & Analysis',
    description: 'How file-based context is intended to support Jela AI conversations.',
    updated: 'August 11, 2026',
    sections: [
      {
        id: 'intended-support', title: 'Intended support', content: <>
          <p>Jela AI is intended to support analysis of selected files inside the native application. Depending on the released capability, this may help with summarising, explaining, comparing or structuring information from a supported document.</p>
          <div className="docs-callout"><Info /><p><strong>Capabilities are still being defined.</strong> Supported formats, file-size limits, image handling and retention behaviour will be documented when the feature is available.</p></div>
        </>,
      },
      {
        id: 'prepare-files', title: 'Prepare useful context', content: <>
          <p>File analysis works best when you explain what the file is and what you want to accomplish. Point to the section that matters, describe the audience and identify any format you want in the response.</p>
        </>,
      },
      {
        id: 'sensitive-content', title: 'Sensitive content', content: <>
          <p>Do not upload secrets, passwords, private keys or information you are not authorised to share. Review the current privacy guidance before adding confidential, regulated or personally sensitive material.</p>
        </>,
      },
    ],
  },
  'plans-and-credits': {
    title: 'Plans & usage',
    description: 'A plain-language overview of plan access, usage availability, and reset behavior.',
    updated: 'August 11, 2026',
    sections: [
      {
        id: 'why-credits', title: 'How usage is managed', content: <>
          <p>AI requests have real operating costs that vary by model and task. Jela AI measures access securely on the server and shows a simple availability state without exposing internal model units.</p>
        </>,
      },
      {
        id: 'plans', title: 'Subscription plans', content: <>
          <p>Plans may define access to capabilities, included usage and renewal periods. No public prices or plan entitlements have been announced on this website.</p>
          <div className="docs-callout"><Info /><p><strong>Authoritative pricing.</strong> Current prices and billing terms come from the production plan catalog. A plan cannot be purchased until secure checkout is enabled server-side.</p></div>
        </>,
      },
      {
        id: 'transparency', title: 'Usage transparency', content: <>
          <p>The application shows whether usage is available and when a Free-plan reset is scheduled. Internal model units, provider costs, and private allowance calculations are not exposed to customers.</p>
        </>,
      },
    ],
  },
  'privacy-and-data': {
    title: 'Privacy & Data',
    description: 'An understandable overview of privacy choices, data responsibility and product boundaries.',
    updated: 'August 11, 2026',
    sections: [
      {
        id: 'overview', title: 'Privacy overview', content: <>
          <p>Jela AI is being designed to collect and use information for defined product purposes, communicate material choices clearly and keep public website responsibilities separate from application accounts.</p>
          <p>This guide provides an accessible overview. The full <Link to="/privacy">Privacy Policy</Link> is the controlling public policy for the website and future service as described there.</p>
        </>,
      },
      {
        id: 'your-input', title: 'Think before you submit', content: <>
          <p>Prompts and attached content can contain personal or confidential information. Share only what is necessary for the task and what you have the right to provide.</p>
        </>,
      },
      {
        id: 'data-controls', title: 'Data controls', content: <>
          <p>Application-level controls for account status and product access are intended to remain appropriately scoped. Detailed retention, deletion, model-processing and conversation-history controls will be documented with the released application.</p>
        </>,
      },
      {
        id: 'contact', title: 'Privacy questions', content: <>
          <p>For a privacy question, email <a href="mailto:zentelinsight@gmail.com">zentelinsight@gmail.com</a>. Include enough detail to help identify the relevant product or request, but do not email passwords or verification codes.</p>
        </>,
      },
    ],
  },
}

export default function DocsArticlePage() {
  const { article: slug = '' } = useParams()
  const article = articles[slug]
  if (!article) return <NotFoundPage />

  const currentIndex = docsNavigation.findIndex((item) => item.slug === slug)
  const next = docsNavigation[currentIndex + 1]

  return (
    <main className="docs-page">
      <Seo title={article.title} description={article.description} path={`/docs/${slug}`} />
      <DocsLayout toc={article.sections.map(({ id, title }) => ({ id, label: title }))}>
        <header className="docs-article__header">
          <p className="eyebrow">Jela AI guide</p>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <span>Last updated {article.updated}</span>
        </header>
        <div className="docs-prose">
          {article.sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.content}
            </section>
          ))}
        </div>
        <div className="docs-article__footer">
          <span>{next ? 'Continue reading' : 'Explore more'}</span>
          <Link to={next ? `/docs/${next.slug}` : '/docs'}>
            {next ? next.label : 'Documentation home'} <ArrowRight size={17} />
          </Link>
        </div>
      </DocsLayout>
    </main>
  )
}
