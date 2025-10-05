'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Register() {
  const r = useRouter();
  const [email, setEmail] = useState('newuser@example.com');
  const [password, setPassword] = useState('pass1234');
  const [displayName, setDisplayName] = useState('My Build Name');
  const [err, setErr] = useState<string|null>(null);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const supabase = sb();

    // sign up
    const { error: e1 } = await supabase.auth.signUp({ email, password });
    if (e1) return setErr(e1.message);

    // sign in
    const { data: s2, error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (e2) return setErr(e2.message);

    // create your player row (one per user)
    const uid = s2.session!.user.id;
    const { error: e3 } = await supabase.from('players').insert({
      user_id: uid,
      name: displayName.trim(),
    });
    // ignore unique-violation if they somehow already have one
    if (e3 && e3.code !== '23505') return setErr(e3.message);

    r.push('/current');
  }

  return (
    <div className="container center">
      <div className="card" style={{maxWidth: 420, width:'100%'}}>
        <div className="h1">Create account</div>
        <form className="row" onSubmit={onRegister}>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
          <input className="input" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="display name (e.g., Aaryan’s Lockdown SF)" />
          {err && <div className="p-muted" style={{color:'#f87171'}}>{err}</div>}
          <button className="btn" type="submit">Create account</button>
        </form>
      </div>
    </div>
  );
}
