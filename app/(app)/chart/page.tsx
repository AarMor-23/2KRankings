'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Brush, CartesianGrid
} from 'recharts';

type Player = { id: string; name: string };
type Week   = { id: string; week_date: string };
type Ranking = { user_id: string; week_id: string; rank_order: string[] };

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// distinct, stable colors
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

  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string>('all');
  const [onlyWithBallots, setOnlyWithBallots] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const supabase = sb();

      // players
      const { data: p, error: perr } = await supabase.from('players').select('id,name').order('name');
      if (perr) { setError(perr.message); setLoading(false); return; }
      const playerList = (p ?? []) as Player[];
      setPlayers(playerList);
      setVisible(new Set(playerList.map(x => x.id)));

      // season -> weeks (or all)
      const { data: seasons } = await supabase
        .from('seasons').select('id,start_date,end_date')
        .order('start_date', { ascending: false }).limit(1);
      const season = seasons?.[0];

      const weeksQuery = season
        ? supabase.from('weeks').select('id,week_date')
            .gte('week_date', season.start_date).lte('week_date', season.end_date)
            .order('week_date')
        : supabase.from('weeks').select('id,week_date').order('week_date');

      const { data: w, error: werr } = await weeksQuery;
      if (werr) { setError(werr.message); setLoading(false); return; }
      const weeksList = (w ?? []) as Week[];
      setWeeks(weeksList);

      // rankings for those weeks
      const ids = weeksList.map(x => x.id);
      if (!ids.length) { setRankings([]); setLoading(false); return; }

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

  // Build ranks per week; optionally keep only weeks that actually have ballots.
  const { data, weeksUsed } = useMemo(() => {
    const out = { data: [] as any[], weeksUsed: [] as Week[] };
    if (!players.length || !weeks.length) return out;

    // points per week (per-ballot length)
    const byWeek = new Map<string, Map<string, number>>();
    for (const w of weeks) byWeek.set(w.id, new Map(players.map(p => [p.id, 0])));

    const weeksWithBallots = new Set<string>();
    for (const ballot of rankings) {
      const wk = byWeek.get(ballot.week_id);
      if (!wk) continue;
      const M = ballot.rank_order.length;
      if (M > 0) weeksWithBallots.add(ballot.week_id);
      ballot.rank_order.forEach((pid, idx) => {
        wk.set(pid, (wk.get(pid) ?? 0) + (M - idx));
      });
    }

    const selectedWeeks = (onlyWithBallots && weeksWithBallots.size > 0)
      ? weeks.filter(w => weeksWithBallots.has(w.id))
      : weeks;

    // convert points → dense rank
    const rows:any[] = [];
    for (const w of selectedWeeks) {
      const pts = byWeek.get(w.id)!;
      const scored = players.map(p => ({ id:p.id, name:p.name, points: pts.get(p.id) ?? 0 }));
      scored.sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));

      const ranks = new Map<string, number>();
      let prevPts: number | null = null;
      let rank = 0;
      for (const s of scored) {
        if (prevPts === null || s.points !== prevPts) { rank += 1; prevPts = s.points; }
        ranks.set(s.id, rank);
      }

      const row:any = { week: w.week_date };
      for (const p of players) row[p.name] = ranks.get(p.id) ?? null;
      rows.push(row);
    }

    out.data = rows;
    out.weeksUsed = selectedWeeks;
    return out;
  }, [players, weeks, rankings, onlyWithBallots]);

  // Legend toggle
  function onLegendClick(o:any) {
    const name = o.value as string;
    const player = players.find(p => p.name === name);
    if (!player) return;
    setFocusId('all');
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(player.id)) next.delete(player.id); else next.add(player.id);
      return next;
    });
  }

  // Focus dropdown
  function onFocusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setFocusId(val);
    if (val === 'all') setVisible(new Set(players.map(p => p.id)));
    else setVisible(new Set([val]));
  }

  const total = players.length;
  const yTicks = Array.from({ length: total }, (_, i) => i + 1);
  const showBrush = (data.length > 12); // only show the mini-timeline when it helps

  return (
    <div className="card" style={{padding: 16}}>
      <div className="h1">Movement Chart</div>

      {loading && <p className="p-muted">Loading…</p>}
      {error && <p className="p-muted" style={{color:'#f87171'}}>{error}</p>}

      {!loading && !error && (
        <>
          <div className="row" style={{gap: 10, alignItems:'center', marginBottom: 8, flexWrap:'wrap'}}>
            <label className="p-muted">Focus:</label>
            <select className="input" value={focusId} onChange={onFocusChange} style={{maxWidth: 260}}>
              <option value="all">All players</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn secondary" onClick={() => { setFocusId('all'); setVisible(new Set(players.map(p=>p.id))); }}>
              Reset
            </button>

            <label className="p-muted" style={{marginLeft:12}}>
              <input
                type="checkbox"
                checked={onlyWithBallots}
                onChange={(e) => setOnlyWithBallots(e.target.checked)}
                style={{marginRight:6}}
              />
              Show only weeks with ballots
            </label>
            <span className="p-muted">({weeksUsed.length} / {weeks.length} weeks)</span>
          </div>

          {players.length === 0 ? (
            <p className="p-muted">No players yet.</p>
          ) : weeksUsed.length === 0 ? (
            <p className="p-muted">No ballots submitted yet.</p>
          ) : (
            // Fill the card with the chart (no awkward empty band)
            <div style={{width:'100%', height:'min(62vh, 560px)'}}>
              <ResponsiveContainer>
                <LineChart
                  data={data}
                  margin={{ top: 6, right: 16, left: 6, bottom: 36 }} // extra bottom so rank N isn’t clipped
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    interval="preserveStartEnd"
                    minTickGap={20}
                    tick={{ fontSize: 12 }}
                  />
                  {/* rank 1 at TOP; exact 1..N ticks */}
                  <YAxis
                    reversed
                    allowDecimals={false}
                    domain={[1, total]}
                    ticks={yTicks}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Legend onClick={onLegendClick} />
                  {players.map((p, i) => (
                    <Line
                      key={p.id}
                      type="monotone"
                      connectNulls
                      dataKey={p.name}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      strokeWidth={2}
                      stroke={colorFor(i, total)}
                      hide={!visible.has(p.id)}
                      isAnimationActive={false}
                    />
                  ))}
                  {showBrush && <Brush dataKey="week" height={22} travellerWidth={8} />}
                </LineChart>
              </ResponsiveContainer>
              <p className="p-muted" style={{marginTop:8}}>
                Dense ranks with ties • Rank&nbsp;1 is at the top • Toggle “Show only weeks with ballots” to auto-zoom.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
