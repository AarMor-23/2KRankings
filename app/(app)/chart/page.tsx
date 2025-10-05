'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type Player = { id: string; name: string };
type Week   = { id: string; week_date: string };
type Ranking = { user_id: string; week_id: string; rank_order: string[] };

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// evenly-spaced HSL colors (stable across reloads for same ordering)
function colorFor(index: number, total: number) {
  const hue = Math.round((360 / Math.max(total, 1)) * index);
  return `hsl(${hue} 70% 55%)`;
}

export default function ChartPage() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [weeks, setWeeks]     = useState<Week[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [error, setError] = useState<string|null>(null);

  // visibility + focus
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string>('all'); // 'all' or a player.id

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const supabase = sb();

      // players
      const { data: p, error: perr } = await supabase.from('players').select('id,name').order('name');
      if (perr) { setError(perr.message); setLoading(false); return; }
      const playerList = (p ?? []) as Player[];
      setPlayers(playerList);
      setVisible(new Set(playerList.map(x => x.id))); // default: all on

      // latest season (if any); else all weeks
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id,start_date,end_date')
        .order('start_date', { ascending: false })
        .limit(1);
      const season = seasons?.[0];

      const weeksQuery = season
        ? supabase.from('weeks').select('id,week_date')
            .gte('week_date', season.start_date)
            .lte('week_date', season.end_date)
            .order('week_date')
        : supabase.from('weeks').select('id,week_date').order('week_date');
      const { data: w, error: werr } = await weeksQuery;
      if (werr) { setError(werr.message); setLoading(false); return; }
      const weeksList = (w ?? []) as Week[];
      setWeeks(weeksList);

      // rankings
      const ids = weeksList.map(x => x.id);
      if (ids.length === 0) { setRankings([]); setLoading(false); return; }
      const { data: r, error: rerr } = await supabase
        .from('rankings')
        .select('user_id,week_id,rank_order')
        .in('week_id', ids);
      if (rerr) { setError(rerr.message); setLoading(false); return; }
      const normalized = (r ?? []).map(x => ({ ...x, rank_order: x.rank_order as unknown as string[] })) as Ranking[];
      setRankings(normalized);

      setLoading(false);
    })();
  }, []);

  // build chart rows: { week: 'YYYY-MM-DD', [playerName]: rankNumber, ... }
  const data = useMemo(() => {
    if (players.length===0 || weeks.length===0) return [];
    const N = players.length;

    // points per player per week
    const byWeek = new Map<string, Map<string, number>>();
    for (const w of weeks) byWeek.set(w.id, new Map(players.map(p => [p.id, 0])));

    for (const ballot of rankings) {
      const wk = byWeek.get(ballot.week_id);
      if (!wk) continue;
      ballot.rank_order.forEach((pid, idx) => {
        wk.set(pid, (wk.get(pid) ?? 0) + (N - idx)); // Borda
      });
    }

    const rows:any[] = [];
    for (const w of weeks) {
      const pts = byWeek.get(w.id)!;
      const scored = players.map(p => ({ id:p.id, name:p.name, points: pts.get(p.id) ?? 0 }));
      scored.sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));
      const ranks = new Map<string, number>();
      scored.forEach((s, i) => ranks.set(s.id, i+1));

      const row:any = { week: w.week_date };
      for (const p of players) row[p.name] = ranks.get(p.id) ?? null;
      rows.push(row);
    }
    return rows;
  }, [players, weeks, rankings]);

  // interactive legend: toggle a line by clicking its label
  function onLegendClick(o:any) {
    const name = o.value as string;
    const player = players.find(p => p.name === name);
    if (!player) return;
    setFocusId('all'); // reset focus when using legend
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(player.id)) next.delete(player.id); else next.add(player.id);
      return next;
    });
  }

  // dropdown focus (show only one player)
  function onFocusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setFocusId(val);
    if (val === 'all') {
      setVisible(new Set(players.map(p => p.id)));
    } else {
      setVisible(new Set([val]));
    }
  }

  const total = players.length;

  return (
    <div className="card" style={{height: 600}}>
      <div className="h1">Movement Chart</div>

      {loading && <p className="p-muted">Loading…</p>}
      {error && <p className="p-muted" style={{color:'#f87171'}}>{error}</p>}

      {!loading && !error && (
        <>
          <div className="row" style={{gap: 8, alignItems:'center', marginBottom: 8}}>
            <label className="p-muted">Focus:</label>
            <select className="input" value={focusId} onChange={onFocusChange} style={{maxWidth: 260}}>
              <option value="all">All players</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn secondary" onClick={() => { setFocusId('all'); setVisible(new Set(players.map(p=>p.id))); }}>
              Reset
            </button>
          </div>

          {weeks.length === 0 || players.length === 0 ? (
            <p className="p-muted">No data.</p>
          ) : (
            <div style={{width:'100%', height:480}}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 16, right: 20, left: 10, bottom: 20 }}>
                  <XAxis dataKey="week" />
                  <YAxis reversed allowDecimals={false} domain={[1, total]} />
                  <Tooltip />
                  <Legend onClick={onLegendClick} />
                  {players.map((p, i) => (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={p.name}
                      dot={false}
                      strokeWidth={2}
                      stroke={colorFor(i, total)}
                      hide={!visible.has(p.id)}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <p className="p-muted" style={{marginTop:8}}>Lower is better (rank 1 at the top). Click legend labels to hide/show lines.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
