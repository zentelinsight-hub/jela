import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  LockKeyhole,
  MessageSquareText,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../components/ButtonLink'
import { FaqList } from '../components/FaqList'
import { HeroMedia } from '../components/HeroMedia'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'
import { faqs, homeCapabilities } from '../data/content'

const workflow = [
  {
    number: '01',
    title: 'Start with your goal',
    description: 'Tell Jela what you are learning, researching, creating or trying to solve.',
  },
  {
    number: '02',
    title: 'Build the context',
    description: 'Add the details, constraints and supported materials that make the request meaningful.',
  },
  {
    number: '03',
    title: 'Refine the result',
    description: 'Ask follow-up questions, test assumptions and shape the answer into something useful.',
  },
]

export default function HomePage() {
  return (
    <main>
      <Seo
        title="Jela AI"
        description="Meet Jela AI, an intelligent Android companion for learning, research, creation and practical problem-solving, powered by Zentel Insight."
        path="/"
      />

      <section className="hero-section">
        <HeroMedia />
        <div className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--light">
              <span className="status-dot" />
              Built for thoughtful work
            </p>
            <h1>
              Intelligence that helps you <span>move forward.</span>
            </h1>
            <p className="hero-copy__lead">
              Jela AI is your companion for learning, research, creation and everyday problem-solving—designed to bring clarity to the work that matters.
            </p>
            <div className="button-row hero-actions">
              <ButtonLink href="/download" variant="success">
                <Download size={19} aria-hidden="true" />
                Download for Android
              </ButtonLink>
              <ButtonLink href="/features" variant="outline">
                Explore Jela AI
                <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
            </div>
            <p className="hero-note">Official Android release information. No website account required.</p>
          </div>
        </div>
        <a className="hero-scroll" href="#discover" aria-label="Scroll to discover Jela AI">
          <span>Discover Jela</span>
          <span className="hero-scroll__line" aria-hidden="true" />
        </a>
      </section>

      <section className="section section--intro" id="discover">
        <div className="container intro-grid">
          <Reveal>
            <p className="eyebrow">A more useful kind of assistance</p>
            <h2 className="display-heading">Think clearly. Learn deeply. Make progress.</h2>
          </Reveal>
          <Reveal className="intro-copy">
            <p>
              Jela is being designed around the way real work unfolds: a first question, better context, a clearer explanation and the next useful step.
            </p>
            <Link className="text-link" to="/about">
              Why we are building Jela <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="section section--ash">
        <div className="container">
          <Reveal className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Capabilities</p>
              <h2>One companion. Many ways to make progress.</h2>
            </div>
            <p>From understanding a difficult idea to shaping a complete project, Jela is intended to meet you where the work begins.</p>
          </Reveal>
          <div className="capability-grid">
            {homeCapabilities.map((item) => {
              const Icon = item.icon
              return (
                <Reveal className="capability-card" key={item.title}>
                  <div className="icon-box"><Icon aria-hidden="true" /></div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </Reveal>
              )
            })}
          </div>
          <Reveal className="centered-action">
            <ButtonLink href="/features" variant="neutral">
              View all capabilities <ArrowRight size={18} aria-hidden="true" />
            </ButtonLink>
          </Reveal>
        </div>
      </section>

      <section className="section workflow-section">
        <div className="container">
          <Reveal className="section-heading section-heading--center">
            <p className="eyebrow">How Jela works</p>
            <h2>A conversation that develops with your thinking.</h2>
          </Reveal>
          <div className="workflow-grid">
            {workflow.map((item) => (
              <Reveal className="workflow-step" key={item.number}>
                <span className="workflow-step__number">{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--feature-band">
        <div className="container feature-band-grid">
          <Reveal className="feature-band-copy">
            <p className="eyebrow">Built for the way you work</p>
            <h2>From a question to a clearer next step.</h2>
            <p>
              Use Jela to study a subject, structure research, improve an idea or reason through a technical challenge. The aim is not simply to return text—it is to help you understand and act.
            </p>
            <ul className="check-list">
              <li><Check aria-hidden="true" /> Explanations shaped around your context</li>
              <li><Check aria-hidden="true" /> Useful structure for projects and research</li>
              <li><Check aria-hidden="true" /> Follow-up questions that keep the thread intact</li>
            </ul>
          </Reveal>
          <Reveal className="concept-panel">
            <div className="concept-panel__top">
              <span className="concept-panel__brand"><img src="/brand/jela-ai-logo.png" alt="" /> Jela AI</span>
              <span className="concept-panel__status"><span /> Thinking with context</span>
            </div>
            <div className="concept-message concept-message--user">
              Help me understand this idea, then show me how to apply it.
            </div>
            <div className="concept-response">
              <Sparkles size={20} aria-hidden="true" />
              <div>
                <span className="skeleton-line skeleton-line--long" />
                <span className="skeleton-line" />
                <span className="skeleton-line skeleton-line--short" />
              </div>
            </div>
            <div className="concept-chips">
              <span><BookOpen size={15} /> Explain simply</span>
              <span><ScanSearch size={15} /> Explore further</span>
              <span><MessageSquareText size={15} /> Ask a follow-up</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section trust-section">
        <div className="container trust-grid">
          <Reveal className="trust-visual">
            <div className="trust-orbit trust-orbit--outer" />
            <div className="trust-orbit trust-orbit--inner" />
            <div className="trust-lock"><LockKeyhole aria-hidden="true" /></div>
          </Reveal>
          <Reveal className="trust-copy">
            <p className="eyebrow">Privacy and responsibility</p>
            <h2>Your work deserves clear boundaries.</h2>
            <p>
              Jela is being built with understandable privacy guidance, application-level account controls and honest communication about what AI can—and cannot—do.
            </p>
            <div className="trust-points">
              <div><ShieldCheck aria-hidden="true" /><span><strong>Transparent by design</strong>Clear product guidance without hidden claims.</span></div>
              <div><LockKeyhole aria-hidden="true" /><span><strong>Purposeful access</strong>Website and future app responsibilities stay separate.</span></div>
            </div>
            <ButtonLink href="/docs/privacy-and-data" variant="outline">Read privacy documentation</ButtonLink>
          </Reveal>
        </div>
      </section>

      <section className="section android-section">
        <div className="container android-card">
          <Reveal className="android-card__copy">
            <p className="eyebrow eyebrow--green">Jela AI for Android</p>
            <h2>Your intelligent companion, wherever the work happens.</h2>
            <p>The native Android experience is being prepared for direct, verified distribution from this website.</p>
            <ButtonLink href="/download" variant="success">
              <Download size={19} aria-hidden="true" />
              Check release availability
            </ButtonLink>
          </Reveal>
          <div className="android-mark" aria-hidden="true">
            <div className="android-mark__ring" />
            <img src="/brand/jela-ai-logo.png" alt="" />
          </div>
        </div>
      </section>

      <section className="section docs-promo-section">
        <div className="container docs-promo">
          <Reveal>
            <p className="eyebrow">Documentation</p>
            <h2>Start informed.</h2>
            <p>Learn how Jela is intended to work, how the official APK will be distributed and what to expect as the product develops.</p>
          </Reveal>
          <Reveal className="docs-promo__links">
            <Link to="/docs/getting-started"><span>01</span>Getting Started<ArrowRight /></Link>
            <Link to="/docs/using-jela"><span>02</span>Using Jela AI<ArrowRight /></Link>
            <Link to="/docs/privacy-and-data"><span>03</span>Privacy & Data<ArrowRight /></Link>
          </Reveal>
        </div>
      </section>

      <section className="section faq-preview-section">
        <div className="container narrow-container">
          <Reveal className="section-heading section-heading--center">
            <p className="eyebrow">Common questions</p>
            <h2>What to know before Jela arrives.</h2>
          </Reveal>
          <Reveal><FaqList items={faqs.slice(0, 4)} /></Reveal>
          <Reveal className="centered-action">
            <ButtonLink href="/faq" variant="neutral">View all questions <ArrowRight size={18} /></ButtonLink>
          </Reveal>
        </div>
      </section>

      <section className="final-cta">
        <div className="container final-cta__inner">
          <div>
            <p className="eyebrow">The next useful step starts here</p>
            <h2>Meet Jela AI on Android.</h2>
          </div>
          <div className="button-row">
            <ButtonLink href="/download" variant="success"><Download size={19} />Download page</ButtonLink>
            <ButtonLink href="/docs" variant="outline">Read the docs</ButtonLink>
          </div>
        </div>
      </section>
    </main>
  )
}
