import { ArrowUpRight, Mail, MessageCircle, Phone } from 'lucide-react'
import { PageIntro } from '../components/PageIntro'
import { Reveal } from '../components/Reveal'
import { Seo } from '../components/Seo'

export default function ContactPage() {
  return (
    <main>
      <Seo
        title="Contact"
        description="Contact Zentel Insight about Jela AI by official email, phone or WhatsApp."
        path="/contact"
      />
      <PageIntro
        eyebrow="Contact"
        title="Talk to the team behind Jela."
        description="For product, release, documentation or privacy questions, contact Zentel Insight directly through one of the verified channels below."
      />
      <section className="section contact-section">
        <div className="container contact-grid">
          <Reveal className="contact-card">
            <div className="icon-box"><Mail /></div>
            <span>Email</span>
            <h2>Send a detailed message</h2>
            <p>Best for product questions, documentation feedback and requests that need context.</p>
            <a href="mailto:zentelinsight@gmail.com">zentelinsight@gmail.com <ArrowUpRight /></a>
          </Reveal>
          <Reveal className="contact-card">
            <div className="icon-box"><MessageCircle /></div>
            <span>WhatsApp</span>
            <h2>Start a direct conversation</h2>
            <p>Use the official Zentel Insight number for a concise Jela AI enquiry.</p>
            <a href="https://wa.me/2347060833927" target="_blank" rel="noreferrer">+234 706 083 3927 <ArrowUpRight /></a>
          </Reveal>
          <Reveal className="contact-card">
            <div className="icon-box"><Phone /></div>
            <span>Phone</span>
            <h2>Call the official line</h2>
            <p>Reach Zentel Insight using the same verified number.</p>
            <a href="tel:+2347060833927">+234 706 083 3927 <ArrowUpRight /></a>
          </Reveal>
        </div>
        <div className="container contact-guidance">
          <h2>Help us help you</h2>
          <p>Include the product name, the page or feature involved, and a clear description of your question. Never send passwords, one-time codes, private keys or other secret credentials by email or WhatsApp.</p>
        </div>
      </section>
    </main>
  )
}
