/* Test double for the Supabase client. Server logic lives in the Python test via window.srv(). */
window.MTC_MOCK_SB = function(){
  const call = async (fn, args) => {
    try{ return await window.srv(JSON.stringify({fn, args, me: (JSON.parse(localStorage.getItem('mock-session') || 'null') || {user: {}}).user.id || null})).then(JSON.parse); }
    catch(e){ return {error: {message: 'Failed to fetch'}}; }
  };
  const q = (table) => {
    const st = {table, op: 'select', cols: null, filters: [], row: null, opts: null, patch: null};
    const b = {
      select(c){ st.op = 'select'; return b; }, upsert(row, o){ st.op = 'upsert'; st.row = row; st.opts = o; return b; },
      delete(){ st.op = 'delete'; return b; }, update(p){ st.op = 'update'; st.patch = p; return b; },
      eq(c, v){ st.filters.push([c, v]); return b; },
      then(res, rej){ return call('table', st).then(res, rej); }
    };
    return b;
  };
  const setSession = s => { if(s) localStorage.setItem('mock-session', JSON.stringify(s)); else localStorage.removeItem('mock-session'); };
  return {
    auth: {
      async signUp(a){ const r = await call('signUp', a); if(r.data && r.data.session) setSession(r.data.session); return r; },
      async signInWithPassword(a){ const r = await call('signIn', a); if(r.data && r.data.session) setSession(r.data.session); return r; },
      async signOut(){ setSession(null); return {error: null}; },
      async getSession(){ return {data: {session: JSON.parse(localStorage.getItem('mock-session') || 'null')}}; },
      onAuthStateChange(){ return {data: {subscription: {unsubscribe(){}}}}; }
    },
    from: q,
    rpc: (name, args) => call('rpc:' + name, args)
  };
};
