import { ArrowRight, CircleHelp, CreditCard, Image, KeyRound, LogIn, MessageSquareText, ShieldCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro'
import { Seo } from '../components/Seo'

const helpTopics = [
  { icon: ShieldCheck, title: 'Account', copy: 'Create, verify and protect your Jela AI account.' },
  { icon: LogIn, title: 'Login', copy: 'Sign in with your password or continue securely with Google.' },
  { icon: KeyRound, title: 'Password', copy: 'Request a secure reset link and choose a new password.' },
  { icon: CreditCard, title: 'Plans & payments', copy: 'Understand plans, Paystack checkout and billing status.' },
  { icon: MessageSquareText, title: 'Using Jela', copy: 'Start conversations, refine answers and manage history.' },
  { icon: Image, title: 'Images & files', copy: 'Upload supported material privately for analysis.' },
  { icon: Wrench, title: 'Troubleshooting', copy: 'Resolve connection, upload, account and update issues.' },
  { icon: CircleHelp, title: 'Contact', copy: 'Reach Zentel Insight when you need direct support.' },
]

export default function HelpPage() {
  return <main>
    <Seo title="Help" description="Get practical help with your Jela AI account, login, plans, payments, conversations, images and files." path="/help" />
    <PageIntro eyebrow="Jela Help" title="Find the right next step." description="Clear guidance for common Jela AI questions, from signing in to using images and managing your plan." />
    <section className="section help-section"><div className="container help-grid">
      {helpTopics.map(({ icon: Icon, title, copy }) => <article className="help-card" key={title}><div className="icon-box"><Icon /></div><h2>{title}</h2><p>{copy}</p></article>)}
    </div><div className="container help-actions"><div><p className="eyebrow">More guidance</p><h2>Explore the documentation or talk to us.</h2></div><div className="button-row"><Link className="button button--neutral" to="/docs">Read documentation <ArrowRight size={18} /></Link><Link className="button button--success" to="/contact">Contact support <ArrowRight size={18} /></Link></div></div></section>
  </main>
}
