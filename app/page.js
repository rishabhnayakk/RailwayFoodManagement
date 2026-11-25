import Link from "next/link";

const roles = [
  ["01", "Passengers", "Scan food QR codes, rate meals, report hygiene concerns and track your submissions."],
  ["02", "Vendors", "Manage your food packages, view QR codes, feedback and business performance."],
  ["03", "Inspectors", "Investigate assigned complaints, record findings and submit evidence-backed reports."],
  ["04", "Administrators", "Manage vendors, inspectors, packages, QR codes, complaints and quality audits."]
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link href="/" className="brand"><span className="brand-mark">R</span> RailGuard</Link>
        <nav className="nav-links">
          <a href="#how-it-works">How it works</a>
          <Link className="btn" href="/login">Sign in</Link>
        </nav>
      </header>
      <section className="hero">
        <div>
          <div className="eyebrow">Passenger food quality & safety</div>
          <h1>Better food. Safer journeys. <span style={{color:"var(--red)"}}>Accountability.</span></h1>
          <p>RailGuard connects passengers, food vendors, inspectors and railway administrators through QR-based food verification, transparent feedback and structured quality audits.</p>
          <div className="hero-actions">
            <Link className="btn" href="/login">Get started</Link>
            <a className="btn btn-outline" href="#how-it-works">Explore the platform</a>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-top"><strong>Quality monitoring</strong><span className="muted"><i className="status-dot"/>Platform workflow</span></div>
          <div className="feature"><div className="feature-icon">QR</div><div><strong>Verify food packages</strong><span>Scan a package QR code to check verified food and vendor information.</span></div></div>
          <div className="feature"><div className="feature-icon">★</div><div><strong>Passenger feedback</strong><span>Collect ratings and actionable feedback from real journeys.</span></div></div>
          <div className="feature"><div className="feature-icon">✓</div><div><strong>Quality investigations</strong><span>Assign complaints and track inspection reports through closure.</span></div></div>
        </div>
      </section>
      <section className="section" id="how-it-works">
        <div className="eyebrow">One connected platform</div>
        <h2>Built for every stakeholder</h2>
        <div className="role-grid">
          {roles.map(([number,title,description]) => <article className="role-card" key={number}><div className="eyebrow">{number}</div><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
    </main>
  );
}
