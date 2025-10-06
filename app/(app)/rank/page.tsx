'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Player = { id: string; name: string };
type Week   = { id: string; week_date: string };

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function todayISO() { return new Date().toISOString().slice(0,10); }

/* --- Sortable row --- */
function SortableRow({ id, index, name, onUp, onDown }: { id:string; index:number; name:string; onUp:()=>void; onDown:()=>void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const dragStyle:any = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  
  return (
    <div
      ref={setNodeRef}
      className="card row-card"
      style={dragStyle}
      {...attributes}
      {...listeners}
    >
      <div><strong>{index + 1}.</strong> {name}</div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn secondary" onClick={onUp}>↑</button>
        <button className="btn secondary" onClick={onDown}>↓</button>
        <span className="badge" style={{ cursor:'grab' }}>⇅</span>
      </div>
    </div>
  );
  
}

export default function RankPage() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [order, setOrder]     = useState<string[]>([]);
  const [week, setWeek]       = useState<Week|null>(null);
  const [canVote, setCanVote] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      const supabase = sb();

      const { data: ses } = await supabase.auth.getSession();
      if (!ses?.session) { setError('Not signed in'); setLoading(false); return; }
      const uid = ses.session.user.id;

      // admin?
      {
        const { data } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
        setIsAdmin(!!data);
      }

      // ensure user has a player
      {
        const { data, error } = await supabase.from('players').select('id').eq('user_id', uid).maybeSingle();
        if (error && error.code !== 'PGRST116') { setError(error.message); setLoading(false); return; }
        if (!data) { setError('No player profile yet. Register with a display name.'); setLoading(false); return; }
      }

      // players
      const { data: p, error: perr } = await supabase.from('players').select('id,name').order('name');
      if (perr) { setError(perr.message); setLoading(false); return; }
      const list = (p ?? []) as Player[];
      setPlayers(list);
      setOrder(list.map(x=>x.id));

      // this Monday or latest Monday
      const { data: wToday } = await supabase.from('weeks').select('id,week_date').eq('week_date', todayISO()).limit(1);
      let w:Week|null = wToday?.[0] ?? null;
      if (!w) {
        const { data: fb, error: ferr } = await supabase.from('weeks').select('id,week_date')
          .lte('week_date', todayISO()).order('week_date', {ascending:false}).limit(1);
        if (ferr) { setError(ferr.message); setLoading(false); return; }
        w = fb?.[0] ?? null;
      }
      setWeek(w);
      setCanVote(!!(wToday && wToday.length>0));

      // prefill
      if (w) {
        const { data: r } = await supabase.from('rankings').select('rank_order')
          .eq('user_id', uid).eq('week_id', w.id).maybeSingle();
        if (r?.rank_order) setOrder(r.rank_order as unknown as string[]);
      }

      setLoading(false);
    })();
  }, []);

  const ordered = useMemo(() => {
    const m = new Map(players.map(p=>[p.id,p]));
    return order.map(id=>m.get(id)!).filter(Boolean);
  }, [players, order]);

  const canSave = !!week && (canVote || isAdmin) && !submitting;

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const curr = order;
    const oldIdx = curr.indexOf(String(active.id));
    const newIdx = curr.indexOf(String(over.id));
    setOrder(arrayMove(curr, oldIdx, newIdx));
  }

  async function submitBallot() {
    if (!week) return;
    setSubmitting(true); setError(null);
    const supabase = sb();
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses!.session!.user.id;

    const { error: e } = await supabase.from('rankings').upsert(
      { user_id: uid, week_id: week.id, rank_order: order },
      { onConflict: 'user_id,week_id' }
    );
    setSubmitting(false);
    if (e) { setError(e.message); return; }
    alert('Ballot saved!');
  }

  return (
    <div className="card">
      <div className="h1">Submit Your Ballot</div>

      {loading && <p className="p-muted">Loading…</p>}
      {error && <p className="p-muted" style={{color:'#f87171'}}>{error}</p>}

      {!loading && !error && (
        <>
          <p className="p-muted" style={{marginBottom:10}}>
            {week ? `Week of ${week.week_date} • ` : 'No active week found • '}
            {canVote ? 'Voting is OPEN (CT).' : isAdmin ? 'Voting is CLOSED • Admin override enabled.' : 'Voting is CLOSED.'}
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <div style={{display:'grid', gap:10}}>
                {ordered.map((p, i) => (
                  <SortableRow
                    key={p.id}
                    id={p.id}
                    index={i}
                    name={p.name}
                    onUp={() => setOrder(prev => {
                      const idx = prev.indexOf(p.id);
                      if (idx<=0) return prev; const next=[...prev];
                      next.splice(idx-1,0,next.splice(idx,1)[0]); return next;
                    })}
                    onDown={() => setOrder(prev => {
                      const idx = prev.indexOf(p.id);
                      if (idx===prev.length-1) return prev; const next=[...prev];
                      next.splice(idx+1,0,next.splice(idx,1)[0]); return next;
                    })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div style={{marginTop:12}}>
            <button className="btn" disabled={!canSave} onClick={submitBallot}>
              {submitting ? 'Saving…' : canVote ? 'Save Ballot' : isAdmin ? 'Save (Admin Override)' : 'Save Ballot'}
            </button>
          </div>

          {!canVote && !isAdmin && week && (
            <p className="p-muted" style={{marginTop:8}}>
              Voting is only open on Mondays (America/Chicago). You can reorder now but must save on Monday.
            </p>
          )}
        </>
      )}
    </div>
  );
}
