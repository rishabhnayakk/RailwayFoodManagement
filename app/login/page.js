import Link from "next/link";

export default function LoginPage() {
  return (
    <main>
      <header className="site-header"><Link href="/" className="brand"><span className="brand-mark">R</span> RailGuard</Link><Link href="/" className="muted">Back to home</Link></header>
      <section className="form-wrap">
        <div className="form-card">
          <div className="eyebrow">Secure access</div>
          <h1>Welcome to RailGuard</h1>
          <p>Use your registered email and password. Your dashboard will depend on your assigned account role.</p>
          <form>
            <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" placeholder="you@example.com" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" placeholder="Enter your password" autoComplete="current-password" required /></div>
            <button className="btn full" type="button" disabled title="Authentication will be connected after Supabase environment setup">Login setup pending</button>
          </form>
          <p className="muted" style={{fontSize:12}}>Passenger registration will be available through Supabase Auth. Vendor and Inspector accounts are provisioned by Admin.</p>
        </div>
      </section>
    </main>
  );
}
