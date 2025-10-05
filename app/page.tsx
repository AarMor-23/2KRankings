'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const r = useRouter();
  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (data.session) r.replace('/current');
      else r.replace('/login');
    });
  }, [r]);
  return null;
}
