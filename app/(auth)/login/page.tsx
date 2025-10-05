'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState('test1@example.com');
  const [password, setPassword] = useState('pass1234');
  const [err, setErr] = useState<string|null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) return setErr(error.message);
    r.push('/current');
  }

  return (
    <div className="container center">
      <div className="card" style={{maxWidth: 420, width:'100%'}}>
        <div className="h1">Login</div>
        <p className="p-muted" style={{marginBottom:12}}>Use any email domain; no verification required.</p>
        <form className="row" onSubmit={onLogin}>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
          {err && <div className="p-muted" style={{color:'#f87171'}}>{err}</div>}
          <div className="actions">
            <button className="btn" type="submit">Login</button>
            <a className="link" href="/register">Need an account? Register</a>
          </div>
        </form>
      </div>
    </div>
  );
}
