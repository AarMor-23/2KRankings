'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const r = useRouter();
  const path = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => {
      if (!data.session) r.push('/login');
      else setEmail(data.session.user.email ?? null);
    });
    const { data: sub } = sb().auth.onAuthStateChange((_e, s) => {
      if (!s) r.push('/login'); else setEmail(s.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [r]);

  async function signOut() {
    await sb().auth.signOut();
    r.push('/login');
  }

  return (
    <div className="container">
      <header className="header">
        <div className="brand"><span className="dot" />2K26 Rankings</div>
        <nav className="nav">
          <Link href="/current" className={path === '/current' ? 'badge' : ''}>Current</Link>
          <Link href="/rank" className={path === '/rank' ? 'badge' : ''}>Rank</Link>
          <Link href="/chart" className={path === '/chart' ? 'badge' : ''}>Chart</Link>
        </nav>
        <div className="user" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{email}</span>
          <button className="btn secondary" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
