'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Player = { id: string; name: string };
type Week = { id: string; week_date: string };
type Ranking = { id: string; user_id: string; week_id: string; rank_order: string[] };

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function CurrentPage() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [week, setWeek] = useState<Week | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const supabase = sb();

      // latest Monday <= today
      const { data: weekRows, error: werr } = await supabase
        .from('weeks')
        .select('id, week_date')
        .lte('week_date', todayISO())
        .order('week_date', { ascending: false })
        .limit(1);

      if (werr) { setError(werr.message); setLoading(false); return; }
      if (!weekRows?.length) { setWeek(null); setLoading(false); return; }
      const w = weekRows[0] as Week;
      setWeek(w);

      // players
      const { data: p, error: perr } = await supabase.from('players').select('id,name').order('name');
      if (perr) { setError(perr.message); setLoading(false); return; }
      setPlayers((p ?? []) as Player[]);

      // ballots
      const { data: r, error: rerr } = await supabase
        .from('rankings')
        .select('id,user_id,week_id,rank_order')
        .eq('week_id', w.id);
      if (rerr) { setError(rerr.message); setLoading(false); return; }
      const norm = (r ?? []).map(x => ({ ...x, rank_order: x.rank_order as unknown as string[] })) as Ranking[];
      setRankings(norm);

      setLoading(false);
    })();
  }, []);

  // standings with Borda (per-ballot length)
  const { rows: standings, tiesByPoints } = useMemo(() => {
    const result = { rows: [] as Array<{playerId:string; name:string; points:number; rank:number}>, tiesByPoints: new Map<number, number>() };
    if (!players.length) return result;

    const pts = new Map<string, number>();
    players.forEach(p => pts.set(p.id, 0));

    for (const ballot of rankings) {
      const arr = ballot.rank_order;
      const M = arr.length;
      arr.forEach((pid, idx) => {
        pts.set(pid, (pts.get(pid) ?? 0) + (M - idx));
      });
    }

    const rows = players.map(p => ({ playerId: p.id, name: p.name, points: pts.get(p.id) ?? 0 }));
    rows.sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));

    // count ties by points
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.points, (counts.get(r.points) ?? 0) + 1);

    // dense rank
    let rank = 0, prevPts: number | null = null;
    const ranked = rows.map(r => {
      if (prevPts === null || r.points !== prevPts) { rank += 1; prevPts = r.points; }
      return { ...r, rank };
    });

    result.rows = ranked;
    result.tiesByPoints = counts;
    return result;
  }, [players, rankings]);

  return (
    <div className="card">
      <div className="h1">Current Standings</div>
      {loading && <p className="p-muted">Loading…</p>}
      {error && <p className="p-muted" style={{ color: '#f87171' }}>Error: {error}</p>}

      {!loading && !error && !week && (
        <p className="p-muted">No weeks yet. Add a season + weeks in Supabase.</p>
      )}

      {!loading && !error && week && (
        <>
          <p className="p-muted" style={{ marginBottom: 10 }}>
            Week of <strong>{week.week_date}</strong> • {rankings.length} ballot(s)
          </p>

          {standings.length === 0 ? (
            <p className="p-muted">No ballots submitted for this week yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(r => {
                  const tied = (tiesByPoints.get(r.points) ?? 0) > 1;
                  return (
                    <tr key={r.playerId}>
                      <td>{tied ? `T-${r.rank}` : r.rank}</td>
                      <td>{r.name}</td>
                      <td>{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
