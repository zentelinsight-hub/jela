import { Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

const groups = [
  {
    title: 'Product',
    links: [
      ['Features', '/features'],
      ['Pricing', '/pricing'],
      ['Download', '/download'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Documentation', '/docs'],
      ['FAQ', '/faq'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Contact', '/contact'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
    ],
  },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="brand" to="/" aria-label="Jela AI home">
            <img src="/brand/jela-ai-mark.png" alt="" width="46" height="46" />
            <span>Jela AI</span>
          </Link>
          <p>An intelligent companion for learning, research, creation and practical problem-solving.</p>
          <div className="footer-contact">
            <a href="mailto:zentelinsight@gmail.com">
              <Mail size={16} aria-hidden="true" />
              zentelinsight@gmail.com
            </a>
            <a href="tel:+2347060833927">
              <Phone size={16} aria-hidden="true" />
              +234 706 083 3927
            </a>
          </div>
        </div>

        <div className="footer-links">
          {groups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map(([label, href]) => (
                  <li key={href}>
                    <Link to={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} Zentel Insight. All rights reserved.</p>
      </div>
    </footer>
  )
}
