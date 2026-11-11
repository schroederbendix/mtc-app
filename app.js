/* MTC app v0.1
   Everything is saved on the player's own phone (localStorage) for now.
   When accounts are added, only the `store` object below changes. */
(function(){
'use strict';
const C = window.MTC || {};
const app = document.getElementById('app');

/* ---------- helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PFX = 'mtc2-';
const store = {
  get(k, d){ try{ const v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(PFX + k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  keys(){ try{ return Object.keys(localStorage).filter(k => k.indexOf(PFX) === 0); }catch(e){ return []; } }
};
const pad = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => dkey(new Date());
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return dkey(d); };
const fmt = k => parse(k).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
const fmtShort = k => parse(k).toLocaleDateString('en-US', {month:'short', day:'numeric'});
const weekStart = k => { const d = parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); };
const uid = () => Math.random().toString(36).slice(2, 10);
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const toastEl = document.getElementById('toast');
function toast(m, special){
  toastEl.textContent = m; toastEl.className = special ? 'badge-earned' : ''; toastEl.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.hidden = true, special ? 4200 : 2800);
}
function ytId(u){
  u = String(u || '').trim(); if(!u) return '';
  const m = u.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if(m) return m[1]; return /^[A-Za-z0-9_-]{11}$/.test(u) ? u : '';
}
function video(u, title){
  const id = ytId(u);
  return `<div class="vid">${id
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" title="${esc(title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`
    : `<div class="soon"><div><b>Coming soon</b>This video is on its way. You’ll hear about it in the newsletter.</div></div>`}</div>`;
}
const courtSvg = `<div class="courtbg" aria-hidden="true"><svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#FFFFFF" stroke-opacity=".16" stroke-width="3"><rect x="-40" y="60" width="1280" height="580"/><path d="M-40 130H1240M-40 570H1240M300 130V570M900 130V570M300 350H900M600 40V660"/></g></svg></div>`;

/* ---------- state ---------- */
let profile = store.get('profile', null);
let entries = store.get('entries', []);
let reflections = store.get('reflections', []);
let plans = store.get('plans', []);
let identity = store.get('identity', {versions: [], draft: ''});
let leading = store.get('leading', {phrases: []});
let done = store.get('done', {});
let rehearsedDates = store.get('rehearsed', {});
let drafts = store.get('draft', {});
function reload(){
  profile = store.get('profile', null); entries = store.get('entries', []); reflections = store.get('reflections', []);
  plans = store.get('plans', []); identity = store.get('identity', {versions: [], draft: ''});
  leading = store.get('leading', {phrases: []}); done = store.get('done', {});
  rehearsedDates = store.get('rehearsed', {}); drafts = store.get('draft', {});
}
function setDraft(k, v){ drafts[k] = v; store.set('draft', drafts); }
function clearDrafts(prefix){ Object.keys(drafts).forEach(k => { if(k.indexOf(prefix) === 0) delete drafts[k]; }); store.set('draft', drafts); }

/* ---------- content ---------- */
const MODS = (C.modules || []).map((m, mi) => ({
  title: m.title,
  lessons: (m.lessons || []).map((l, li) => Object.assign({}, l, {key: mi + '.' + li + '|' + (l.title || ''), mi, li}))
}));
const ALL = MODS.flatMap(m => m.lessons);
const isDone = l => !!done[l.key];
const J = C.journal || {};
const sortScale = s => (s || []).slice().sort((a, b) => b[0] - a[0]);
const PS = sortScale(J.presentScale), US = sortScale(J.purposeScale);
const scaleText = (S, v) => { const s = S.find(x => v >= x[0]); return s ? s[1] : ''; };

/* ---------- derived data ---------- */
function dayset(){ return new Set(entries.map(e => e.date)); }
function streaks(){
  const D = dayset(); let cur = 0, k = today();
  if(!D.has(k)) k = addDays(k, -1);
  while(D.has(k)){ cur++; k = addDays(k, -1); }
  let best = 0, run = 0, prev = null;
  [...D].sort().forEach(d => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return {cur, best};
}
function weekStats(ws){
  const we = addDays(ws, 6), E = entries.filter(e => e.date >= ws && e.date <= we);
  return {
    E, n: E.length, present: avg(E.map(e => e.rating)),
    purpose: avg(E.filter(e => e.purpose != null).map(e => e.purpose)),
    rehearsed: E.filter(e => e.rehearsed === true).length, matches: E.filter(e => e.type === 'Match').length,
    best: E.length ? E.reduce((a, b) => b.rating > a.rating ? b : a) : null
  };
}
function activePlan(){
  const t = today();
  const current = plans.filter(p => p.week <= t).sort((a, b) => a.week < b.week ? 1 : -1)[0];
  if(current) return current;
  // first plan ever: show it right away instead of making the player wait for Monday
  return plans.slice().sort((a, b) => a.week < b.week ? -1 : 1)[0] || null;
}
function focusGoals(){
  const p = activePlan();
  if(p && p.goals && p.goals.length) return {goals: p.goals, from: 'plan'};
  return {goals: ((profile && profile.goals) || []).slice(0, 2), from: 'profile'};
}
const BADGES = [
  {id:'first', name:'First entry', hint:'Write your first journal entry', ic:'1', test:() => entries.length >= 1},
  {id:'identity', name:'Identity written', hint:'Save your player identity', ic:'ID', test:() => identity.versions.length >= 1},
  {id:'s3', name:'3 days in a row', hint:'Journal three days in a row', ic:'3', test:() => streaks().best >= 3},
  {id:'s7', name:'7 days in a row', hint:'A full week without missing', ic:'7', test:() => streaks().best >= 7},
  {id:'match', name:'Match day', hint:'Journal after a match', ic:'M', test:() => entries.some(e => e.type === 'Match')},
  {id:'eight', name:'Locked in', hint:'Rate yourself 8 or higher', ic:'8', test:() => entries.some(e => e.rating >= 8)},
  {id:'comeback', name:'Bounce back', hint:'Improve by 3+ points on your last entry', ic:'↑', test:() => {
    const E = entries.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.t || 0) - (b.t || 0));
    return E.some((e, i) => i > 0 && e.rating - E[i - 1].rating >= 3);
  }},
  {id:'weekly', name:'Week reviewed', hint:'Finish your first weekly reflection', ic:'W', test:() => reflections.length >= 1},
  {id:'ten', name:'10 entries', hint:'Ten reflections written', ic:'10', test:() => entries.length >= 10},
  {id:'thirty', name:'30 entries', hint:'Thirty reflections. That’s a habit.', ic:'30', test:() => entries.length >= 30}
];
const earnedIds = () => new Set(BADGES.filter(b => b.test()).map(b => b.id));
function announceNewBadges(before, fallback){
  const earned = BADGES.filter(b => b.test() && !before.has(b.id));
  if(earned.length) toast('New badge: ' + earned.map(b => b.name).join(', '), true); else if(fallback) toast(fallback);
}

/* ---------- onboarding ---------- */
let ob = {step: 0, name: '', level: '', goals: [], own: '', change: ''};
function renderOnboarding(){
  document.body.classList.add('onboarding');
  document.getElementById('topbar').hidden = false;
  const dots = `<div class="dots">${[0, 1, 2].map(i => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if(ob.step === 0){
    body = `<h1>Let’s set up your mental game.</h1>
      <p class="sub">Three quick questions so this fits you. It takes about two minutes.</p>
      <label class="f">What should I call you?<input class="field" id="ob-name" autocomplete="given-name" maxlength="40" value="${esc(ob.name)}" placeholder="First name"></label>
      <div class="f">Where are you in your tennis?</div>
      <div class="choices" id="ob-levels">${(C.levels || []).map(l => `<button type="button" class="choice" data-level="${esc(l)}" aria-pressed="${ob.level === l}"><span class="box">${ob.level === l ? '✓' : ''}</span><span>${esc(l)}</span></button>`).join('')}</div>
      <button class="btn pri" id="ob-next" ${ob.name.trim() && ob.level ? '' : 'disabled'}>Next</button>`;
  } else if(ob.step === 1){
    body = `<h1>What do you want to work on?</h1>
      <p class="sub">Pick up to three. Your journal questions and your weekly goals start from these.</p>
      <div class="choices" id="ob-goals">${(C.goalOptions || []).map(g => `<button type="button" class="choice" data-goal="${esc(g)}" aria-pressed="${ob.goals.includes(g)}"><span class="box">${ob.goals.includes(g) ? '✓' : ''}</span><span>${esc(g)}</span></button>`).join('')}</div>
      <label class="f">Something else? <span class="mute" style="font-weight:500">(optional)</span><input class="field" id="ob-own" maxlength="120" value="${esc(ob.own)}" placeholder="In your own words"></label>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="ob-back">Back</button><button class="btn pri" id="ob-next" ${(ob.goals.length || ob.own.trim()) ? '' : 'disabled'}>Next</button></div>`;
  } else {
    body = `<h1>One more thing.</h1>
      <p class="sub">What is the one thing you would change about how you play under pressure? A sentence or two is plenty. You can skip this.</p>
      <label class="f"><textarea class="field" id="ob-change" rows="4" placeholder="When the score gets close, I…">${esc(ob.change)}</textarea></label>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="ob-back">Back</button><button class="btn pri" id="ob-finish">Build my roadmap</button></div>
      <p class="mute" style="font-size:14px;margin-top:22px">Your entries stay on this phone. Nobody else can read them, not even me.</p>`;
  }
  app.innerHTML = `<div class="ob"><div class="top">${dots}</div><main>${body}</main></div>`;
  window.scrollTo(0, 0);
}
function obSync(){
  const next = document.getElementById('ob-next'); if(!next) return;
  const ok = ob.step === 0 ? (ob.name.trim() && ob.level) : (ob.goals.length || ob.own.trim());
  next.disabled = !ok;
}
function obClick(e){
  const lv = e.target.closest('[data-level]');
  if(lv){ ob.level = lv.dataset.level; document.querySelectorAll('[data-level]').forEach(b => { const on = b.dataset.level === ob.level; b.setAttribute('aria-pressed', String(on)); b.querySelector('.box').textContent = on ? '✓' : ''; }); obSync(); return true; }
  const g = e.target.closest('[data-goal]');
  if(g){
    const v = g.dataset.goal, i = ob.goals.indexOf(v);
    if(i >= 0) ob.goals.splice(i, 1); else if(ob.goals.length < 3) ob.goals.push(v); else { toast('Pick up to three. Tap one to remove it.'); return true; }
    document.querySelectorAll('[data-goal]').forEach(b => { const on = ob.goals.includes(b.dataset.goal); b.setAttribute('aria-pressed', String(on)); b.querySelector('.box').textContent = on ? '✓' : ''; });
    obSync(); return true;
  }
  if(e.target.id === 'ob-next'){ ob.step++; renderOnboarding(); return true; }
  if(e.target.id === 'ob-back'){ ob.step--; renderOnboarding(); return true; }
  if(e.target.id === 'ob-finish'){
    const goals = ob.goals.slice(); if(ob.own.trim()) goals.push(ob.own.trim());
    profile = {name: ob.name.trim(), level: ob.level, goals, change: ob.change.trim(), joined: today()};
    store.set('profile', profile);
    document.body.classList.remove('onboarding');
    location.hash = '#roadmap'; route(); window.scrollTo(0, 0);
    toast('You’re in. Start with the first step.');
    return true;
  }
  return false;
}

/* ---------- roadmap ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if(currentView() === 'roadmap') route(); });
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function roadmapSteps(){
  const first = ALL.find(l => l.mi === 1 && l.li === 0) || ALL[0];
  return [
    {t:'Watch “' + (first ? first.title : 'the first lesson') + '”', s:'Why the picture you hold of yourself decides how you play.', href: first ? '#lesson/' + encodeURIComponent(first.key) : '#classroom', done: first ? isDone(first) : false, r:'8 min'},
    {t:'Write your player identity', s:'Who you decide to be on court, in third person.', href:'#foundation/identity', done: identity.versions.length > 0, r:'10 min'},
    {t:'Set your plan for when you’re leading', s:'Two or three sentences for the moment you’re winning.', href:'#foundation/leading', done: leading.phrases.length >= 2, r:'5 min'},
    {t:'Write your first journal entry', s:'Right after your next practice or match.', href:'#journal', done: entries.length >= 1, r:'2 min'},
    {t:'Do your first weekly reflection', s:'Look at your week and set goals for the next one.', href:'#journal/weekly', done: reflections.length >= 1, r:'10 min'}
  ];
}
function viewRoadmap(){
  const steps = roadmapSteps(), nextI = steps.findIndex(s => !s.done), next = steps[nextI];
  const {cur} = streaks(), t = today(), last7 = weekStats(addDays(t, -6));
  const l7 = entries.filter(e => e.date >= addDays(t, -6) && e.date <= t);
  const l7avg = avg(l7.map(e => e.rating));
  const big = l7.length
    ? `<div class="n">${l7avg}<small>/10</small></div><div class="l">Present-moment average, last 7 days</div><div class="s">${l7.length} ${l7.length === 1 ? 'entry' : 'entries'} · ${cur} ${cur === 1 ? 'day' : 'days'} in a row</div>`
    : `<div class="n${cur ? ' on' : ''}">${cur}</div><div class="l">${cur === 1 ? 'day in a row' : 'days in a row'}</div><div class="s">Your first journal entry starts the count.</div>`;
  const doneCount = steps.filter(s => s.done).length;
  const results = (C.results || []).length ? `<section class="sec wrap"><div class="sech"><h2>What players see</h2></div><div class="results">${C.results.map(r => `<div class="result"><b>${esc(r.name)}</b><p>${esc(r.line)}</p></div>`).join('')}</div></section>` : '';
  const showInstall = !isStandalone() && !store.get('hide-install', false);
  const install = showInstall ? `<section class="sec wrap" style="padding-block:28px 0"><div class="card install"><div class="row"><div><h3>Put MTC on your home screen</h3><p>${installEvt ? 'One tap and it opens like any other app.' : isIOS() ? 'In Safari, tap the Share button, then “Add to Home Screen”.' : 'In your browser menu, tap “Install app” or “Add to Home screen”.'}</p></div><div style="display:flex;gap:10px;flex-wrap:wrap">${installEvt ? '<button class="btn pri" data-install>Install</button>' : ''}<button class="btn sm" data-hide-install>Not now</button></div></div></div></section>` : '';
  return `<section class="hero">${courtSvg}<div class="wrap"><div class="herogrid">
      <div>
        <h1>Hey ${esc(profile.name)}.</h1>
        <p class="promise">${doneCount === steps.length ? 'Your foundation is set. Now it’s about the reps: journal daily, reflect weekly.' : 'This is your roadmap. Do the next step, then come back here.'}</p>
        <div class="cta">${next ? `<a class="btn pri" href="${next.href}">${esc(next.t.length > 44 ? 'Do the next step' : 'Next: ' + next.t)}</a>` : `<a class="btn pri" href="#journal">Open your journal</a>`}</div>
      </div>
      <div class="bignum">${big}</div>
  </div></div></section>
  ${install}
  <section class="sec wrap">
    <div class="sech"><h2>Your roadmap</h2><span class="mute" style="font-size:15px">${doneCount} of ${steps.length} done</span></div>
    <div class="steps">${steps.map((s, i) => `<a class="step${s.done ? ' done' : ''}${i === nextI ? ' next' : ''}" href="${s.href}"><span class="n">${s.done ? '✓' : i + 1}</span><span><div class="t">${esc(s.t)}</div><div class="s">${esc(s.s)}</div></span><span class="r">${esc(s.r)}</span></a>`).join('')}</div>
  </section>
  <section class="sec wrap">
    <div class="sech"><h2>How to get the most out of it</h2></div>
    <div class="rulegrid">${(C.rules || []).map(r => `<div class="rulecard"><b>${esc(r[0])}</b><p>${esc(r[1])}</p></div>`).join('')}</div>
  </section>
  ${results}
  <footer><div class="wrap">
    <div><div class="fin">One point at a time.</div><p class="mute">New lessons and ideas go out in the newsletter first. Made by ${esc(C.coach || '')}.</p>
      <div class="tools"><button class="linkbtn" data-backup>Download my data</button><button class="linkbtn" data-restore>Restore from a backup</button><button class="linkbtn" data-reset>Start over</button><input type="file" id="restore-file" accept="application/json,.json" hidden></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn pri" href="${esc(C.substack || '#')}" target="_blank" rel="noopener">Read the newsletter</a><a class="btn" href="${esc(C.instagram || '#')}" target="_blank" rel="noopener">Instagram</a></div>
  </div></footer>`;
}

/* ---------- foundation ---------- */
function viewFoundation(){
  const idOK = identity.versions.length > 0, ldOK = leading.phrases.length >= 2;
  return `<section class="sec wrap">
    <div class="sech"><h2>Foundation</h2></div>
    <p class="lead">Do this once, then come back to it. Read it before practice and your journal gets easier to fill in, because you know who you’re trying to be.</p>
    <div class="fgrid">
      <a class="fcard" href="#foundation/identity"><span class="tag${idOK ? ' ok' : ''}">${idOK ? 'Written' : 'To do'}</span><h3>Player identity</h3><p>Who you decide to be on court. Written in third person, read before every practice.</p></a>
      <a class="fcard" href="#foundation/leading"><span class="tag${ldOK ? ' ok' : ''}">${ldOK ? 'Written' : 'To do'}</span><h3>When I’m leading</h3><p>What you tell yourself when you’re winning, so you don’t drift when it feels easy.</p></a>
    </div></section>`;
}
function currentIdentityText(){
  if(typeof drafts.identity === 'string') return drafts.identity;
  const v = identity.versions[0]; return v ? v.text : '';
}
function viewIdentity(){
  const I = C.identity || {}, text = currentIdentityText();
  return `<section class="sec wrap lesson">
    <a class="back" href="#foundation">← Foundation</a>
    <h2>Player identity</h2>
    <p class="lead" style="margin-top:12px">${esc(I.intro || '')}</p>
    <div class="qb" style="margin-bottom:22px"><div class="qt">Questions to answer</div><ul class="prompts">${(I.prompts || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <details class="ex" style="margin-bottom:26px"><summary>See my own example</summary><p>${esc(I.example || '')}</p></details>
    <textarea class="editor" id="id-text" placeholder="${esc(profile.name)} is…" aria-label="Your player identity">${esc(text)}</textarea>
    <div class="saved" id="id-saved">${drafts.identity != null ? 'Draft saved on this phone.' : ''}</div>
    <div class="cta" style="margin-top:12px"><button class="btn pri" data-save-identity>Save this version</button><button class="btn" data-rehearse>Read it before practice</button></div>
    ${identity.versions.length ? `<div style="margin-top:38px"><h3 style="font-size:24px;margin-bottom:8px">Your versions</h3>${identity.versions.map((v, i) => `<div class="ver"><div class="h"><span>${i === 0 ? 'Latest · ' : ''}${esc(fmt(v.date))}</span><button class="linkbtn" data-restore-version="${esc(v.id)}">Edit this one</button></div><p>${esc(v.text)}</p></div>`).join('')}</div>` : ''}
  </section>`;
}
function viewLeading(){
  const L = C.leading || {}, ph = leading.phrases;
  return `<section class="sec wrap lesson">
    <a class="back" href="#foundation">← Foundation</a>
    <h2>When I’m leading</h2>
    <p class="lead" style="margin-top:12px">${esc(L.intro || '')}</p>
    <div class="phrases" id="phrases">${ph.length ? ph.map((p, i) => `<div class="phrase"><div class="field" style="border-color:rgba(215,239,79,.4)">${esc(p)}</div><button class="linkbtn" data-del-phrase="${i}" aria-label="Remove this sentence">Remove</button></div>`).join('') : '<p class="mute" style="margin:0">Nothing here yet. Write your first sentence below.</p>'}</div>
    <div class="addrow" style="margin-top:16px"><input class="field" id="phrase-in" maxlength="140" placeholder="When I’m up, I tell myself…"><button class="btn pri" data-add-phrase>Add</button></div>
    <div class="qb" style="margin-top:34px"><div class="qt">Need a starting point?<small>Tap one to add it, then change it to sound like you.</small></div>
      <div class="chips">${(L.examples || []).map(x => `<button class="chip" data-chip="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
  </section>`;
}
function openRehearse(){
  const v = identity.versions[0], text = (v && v.text) || (typeof drafts.identity === 'string' ? drafts.identity : '');
  if(!text.trim()){ toast('Write a few lines first, then you can read them here.'); return; }
  const el = document.getElementById('rehearse');
  el.innerHTML = `<div class="in"><h2>${esc(profile.name)}, this is who you are.</h2><p>${esc(text)}</p><div class="lead2">Read it slowly once. Then walk onto the court as that player.</div><div><button class="btn pri" data-close-rehearse>I’m ready</button></div></div>`;
  el.hidden = false; document.body.style.overflow = 'hidden'; el.scrollTop = 0;
}
function closeRehearse(){
  document.getElementById('rehearse').hidden = true; document.body.style.overflow = '';
  rehearsedDates[today()] = true; store.set('rehearsed', rehearsedDates);
  toast('Nice. That counts for today’s journal.');
}

/* ---------- journal ---------- */
let rating = null, purpose = null, jtype = 'Practice', rehearsedAns = null, jdate = null;
function viewJournal(sub){
  return sub === 'weekly' ? viewWeekly() : viewDaily();
}
const journalHead = sub => `<div class="sech"><h2>Journal</h2><div class="seg" role="group" aria-label="Daily or weekly"><a href="#journal"${sub === 'daily' ? ' aria-current="true"' : ''}>Daily</a><a href="#journal/weekly"${sub === 'weekly' ? ' aria-current="true"' : ''}>Weekly</a></div></div>`;
function viewDaily(){
  const {cur, best} = streaks(), D = dayset(), t = today();
  const last7 = []; for(let i = 6; i >= 0; i--) last7.push(addDays(t, -i));
  const E = entries.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.t || 0) - (a.t || 0));
  const Q = J.questions || [], F = focusGoals();
  if(!jdate) jdate = t;
  if(rehearsedAns == null && rehearsedDates[jdate]) rehearsedAns = true;
  const Cc = E.slice(0, 20).reverse();
  let chart = '';
  if(Cc.length > 1){
    const W = 600, H = 160, P = 26, X = i => P + i * (W - 2 * P) / (Cc.length - 1), Y = v => H - 22 - (v / 10) * (H - 40);
    chart = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your present-moment ratings over time">${[0, 5, 10].map(v => `<line x1="${P}" x2="${W - P}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.14)"/><text x="${P - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="#A6B1C8">${v}</text>`).join('')}
      <polyline points="${Cc.map((e, i) => X(i).toFixed(1) + ',' + Y(e.rating).toFixed(1)).join(' ')}" fill="none" stroke="#79A9F6" stroke-width="2.4" stroke-linejoin="round"/>
      ${Cc.map((e, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(e.rating).toFixed(1)}" r="${e.type === 'Match' ? 5.5 : 4}" fill="${e.type === 'Match' ? '#D7EF4F' : '#79A9F6'}"><title>${esc(fmt(e.date))}: ${e.rating}/10</title></circle>`).join('')}</svg>
      <div class="mute" style="font-size:14px">Your last ${Cc.length} ratings. Yellow dots are matches.</div></div>`;
  }
  const entryHtml = e => `<div class="entry"><div class="h"><span><b>${esc(fmt(e.date))}</b> <span class="mute">· ${esc(e.type)}</span></span><span class="score">${e.rating}<small style="font-size:15px;color:var(--mute)">/10</small></span></div>
    ${e.purpose != null ? `<div class="mute" style="font-size:14px">Purpose ${e.purpose}/10${e.rehearsed === true ? ' · Read my identity first' : ''}</div>` : (e.rehearsed === true ? '<div class="mute" style="font-size:14px">Read my identity first</div>' : '')}
    ${Q.map((q, i) => e.a && e.a[i] ? `<div><div class="q">${esc(q)}</div><p>${esc(e.a[i])}</p></div>` : '').join('')}
    ${(e.g || []).filter(x => x.answer).map(x => `<div><div class="q">Goal: ${esc(x.goal)}</div><p>${esc(x.answer)}</p></div>`).join('')}
    <div><button class="linkbtn" data-del="${esc(e.id)}">Delete</button></div></div>`;
  return `<section class="sec wrap">
    ${journalHead('daily')}
    <p class="lead">Two minutes after every practice or match. Your entries stay on this phone. Nobody else can read them, not even me.</p>
    <div class="streak"><div class="flame${cur ? ' on' : ''}">${cur}</div>
      <div><div class="lbl">${cur === 1 ? 'day in a row' : 'days in a row'}</div><div class="sub">${cur ? (D.has(t) ? 'You’ve journaled today. Nice work.' : 'Journal today to keep it going.') : 'Write today’s entry to start a streak.'} Longest: ${best}</div>
      <div class="days" aria-label="Last 7 days">${last7.map(d => `<span class="${D.has(d) ? 'on' : ''}${d === t ? ' today' : ''}" title="${esc(fmt(d))}">${'SMTWTFS'[parse(d).getDay()]}</span>`).join('')}</div></div></div>
    <div class="badges">${BADGES.map(b => { const g = b.test(); return `<div class="badge${g ? ' got' : ''}"><span class="ic" aria-hidden="true">${g ? esc(b.ic) : ''}</span><b>${esc(b.name)}</b><small>${g ? 'Earned' : esc(b.hint)}</small></div>`; }).join('')}</div>
    <div class="jgrid">
      <div class="jform"><h3>Today’s entry</h3>
        <div class="jmeta"><div class="seg" role="group" aria-label="Practice or match">${['Practice', 'Match'].map(x => `<button type="button" data-type="${x}" aria-pressed="${jtype === x}">${x}</button>`).join('')}</div>
          <label class="jdate"><span class="mute">Date</span><input type="date" id="j-date" value="${jdate}" max="${t}"></label></div>
        ${F.goals.length ? `<div class="focusbox"><b>${F.from === 'plan' ? 'Your goals this week' : 'Your focus'}</b><ul>${F.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}
        <div class="qb"><div class="qt">Did I read my player identity before this one?</div>
          <div class="yn" role="group" aria-label="Read identity before"><button type="button" data-reh="yes" aria-pressed="${rehearsedAns === true}">Yes</button><button type="button" data-reh="no" aria-pressed="${rehearsedAns === false}">No</button></div></div>
        <div class="qb"><div class="qt" id="present-label">How present was I?<small>${esc(J.focus || '')}</small></div>
          <div class="scale" role="group" aria-labelledby="present-label" data-scale="present">${Array.from({length: 11}, (_, i) => `<button type="button" data-v="${i}" aria-pressed="${rating === i}">${i}</button>`).join('')}</div>
          <div class="ends"><span>Not at all</span><span>Every point</span></div>
          <div class="sdesc" id="present-desc">${rating == null ? 'Tap a number. 10 means every point was its own point.' : esc(scaleText(PS, rating))}</div></div>
        <div class="qb"><div class="qt" id="purpose-label">How well did I practice with purpose?<small>Optional</small></div>
          <div class="scale" role="group" aria-labelledby="purpose-label" data-scale="purpose">${Array.from({length: 11}, (_, i) => `<button type="button" data-v="${i}" aria-pressed="${purpose === i}">${i}</button>`).join('')}</div>
          <div class="sdesc" id="purpose-desc">${purpose == null ? '' : esc(scaleText(US, purpose))}</div></div>
        ${Q.map((q, i) => `<label class="qb"><span class="qt">${esc(q)}</span><textarea class="line" data-draft="q${i}" id="j-q${i}" rows="3" placeholder="Write a few sentences">${esc(drafts['q' + i] || '')}</textarea></label>`).join('')}
        ${F.goals.map((g, i) => `<label class="qb"><span class="qt">How did I work on this today?<small>${esc(g)}</small></span><textarea class="line" data-draft="g${i}" id="j-g${i}" rows="2" placeholder="Optional">${esc(drafts['g' + i] || '')}</textarea></label>`).join('')}
        <div><button class="btn pri" data-save-entry>Save entry</button></div>
      </div>
      <div class="jlist"><h3>Your entries</h3>${chart}
        <div>${E.length ? E.map(entryHtml).join('') : '<p class="mute" style="margin:0">Your saved entries will show up here, with a chart of how present you stayed over time.</p>'}</div>
        ${E.length ? '<div><button class="btn sm" data-export-journal>Download my journal</button></div>' : ''}
      </div>
    </div></section>`;
}
function viewWeekly(){
  const t = today(), ref = weekStart(addDays(t, -1)), next = addDays(ref, 7), st = weekStats(ref);
  const prev = weekStats(addDays(ref, -7)), existing = reflections.find(r => r.week === ref);
  const plan = plans.find(p => p.week === next);
  const WQ = J.weeklyQuestions || [];
  const goalVals = [0, 1, 2].map(i => drafts['wg' + i] != null ? drafts['wg' + i] : (plan && plan.goals[i]) || '');
  const ansVal = i => drafts['w' + i] != null ? drafts['w' + i] : (existing && existing.a && existing.a[i]) || '';
  const trend = st.present != null && prev.present != null ? (st.present > prev.present ? 'Up from ' + prev.present + ' last week.' : st.present < prev.present ? 'Down from ' + prev.present + ' last week.' : 'Same as last week.') : '';
  const past = reflections.slice().sort((a, b) => a.week < b.week ? 1 : -1);
  return `<section class="sec wrap">
    ${journalHead('weekly')}
    <p class="lead">Ten minutes, once a week. Look at what happened, write what you learned, and decide what you’ll work on next.</p>
    <div class="qb" style="margin-bottom:34px"><div class="qt">Week of ${esc(fmtShort(ref))} to ${esc(fmtShort(addDays(ref, 6)))}<small>${esc(trend)}</small></div>
      <div class="stats">
        <div class="stat"><div class="v">${st.n}</div><div class="k">${st.n === 1 ? 'entry' : 'entries'}</div></div>
        <div class="stat"><div class="v">${st.present == null ? '–' : st.present}<small>${st.present == null ? '' : '/10'}</small></div><div class="k">present, average</div></div>
        <div class="stat"><div class="v">${st.purpose == null ? '–' : st.purpose}<small>${st.purpose == null ? '' : '/10'}</small></div><div class="k">purpose, average</div></div>
        <div class="stat"><div class="v">${st.rehearsed}</div><div class="k">read my identity first</div></div>
      </div>
      ${st.best ? `<div class="mute" style="font-size:15px">Best day: ${esc(fmt(st.best.date))}, ${st.best.rating}/10 (${esc(st.best.type.toLowerCase())}).</div>` : '<div class="mute" style="font-size:15px">No entries in this week yet. You can still set your goals below.</div>'}
    </div>
    <div class="jgrid" style="border-top:0;padding-top:0">
      <div class="jform"><h3>Your reflection</h3>
        ${existing ? '<div class="mute" style="font-size:15px;margin-top:-14px">You already reflected on this week. Saving again updates it.</div>' : ''}
        ${WQ.map((q, i) => `<label class="qb"><span class="qt">${esc(q)}</span><textarea class="line" data-draft="w${i}" rows="3" placeholder="Write a few sentences">${esc(ansVal(i))}</textarea></label>`).join('')}
      </div>
      <div class="jform"><h3>Goals for next week</h3>
        <p class="mute" style="margin:-14px 0 0;font-size:15px">Up to three. Make them small and specific. They show up in your daily journal next week.</p>
        ${[0, 1, 2].map(i => `<label class="qb"><span class="qt">Goal ${i + 1}${i ? '<small>Optional</small>' : ''}</span><input class="field" data-draft="wg${i}" maxlength="140" value="${esc(goalVals[i])}" placeholder="${i === 0 ? 'For example: use my reset after every long point' : ''}"></label>`).join('')}
        ${(profile.goals || []).length ? `<div class="qb"><div class="qt" style="font-size:16px">From your focus areas<small>Tap to use as a goal</small></div><div class="chips">${profile.goals.map(g => `<button class="chip" data-goal-chip="${esc(g)}">${esc(g)}</button>`).join('')}</div></div>` : ''}
        <div><button class="btn pri" data-save-weekly>Save reflection and goals</button></div>
      </div>
    </div>
    ${past.length ? `<div style="margin-top:44px;border-top:1px solid var(--rule);padding-top:30px"><h3 style="font-size:28px;margin-bottom:6px">Past weeks</h3>${past.map(r => `<div class="entry"><div class="h"><span><b>Week of ${esc(fmtShort(r.week))}</b></span><span class="score">${r.stats && r.stats.present != null ? r.stats.present : '–'}<small style="font-size:15px;color:var(--mute)">/10</small></span></div>
      ${WQ.map((q, i) => r.a && r.a[i] ? `<div><div class="q">${esc(q)}</div><p>${esc(r.a[i])}</p></div>` : '').join('')}
      ${(r.goals || []).length ? `<div><div class="q">Goals I set</div><p>${esc(r.goals.join('\n'))}</p></div>` : ''}</div>`).join('')}</div>` : ''}
  </section>`;
}

/* ---------- classroom ---------- */
function viewClassroom(){
  const n = ALL.filter(isDone).length;
  return `<section class="sec wrap" id="classroom-list">
    <div class="sech"><h2>Classroom</h2><div class="overall"><span>${n} of ${ALL.length} lessons done</span><span class="track"><i style="width:${ALL.length ? n / ALL.length * 100 : 0}%"></i></span></div></div>
    <p class="lead">Watch one lesson, try it in your next practice, then write about it in your journal. New lessons get added over time.</p>
    ${MODS.map(m => { const d = m.lessons.filter(isDone).length; return `<div class="module"><div class="mhead"><h3>${esc(m.title)}</h3><span class="mute" style="font-size:15px">${d} of ${m.lessons.length} done</span></div>
      <div class="lessons">${m.lessons.map((l, i) => `<a class="lrow${isDone(l) ? ' done' : ''}" href="#lesson/${encodeURIComponent(l.key)}"><span class="n">${isDone(l) ? '✓' : i + 1}</span><span><span class="t">${esc(l.title)}</span>${ytId(l.video) ? '' : '<br><span class="s">Video coming soon</span>'}</span><span class="r">${l.minutes ? esc(l.minutes) + ' min' : ''}</span></a>`).join('')}</div></div>`; }).join('')}
  </section>
  <section class="sec wrap"><div class="sech"><h2>Routines</h2></div>
    <p class="lead">Short routines for on court. Pick one and use it until it’s automatic.</p>
    <div class="routines">${(C.routines || []).map(x => `<article class="routine"><h3>${esc(x.title)}</h3>${x.when ? `<div class="when">${esc(x.when)}</div>` : ''}<ol>${(x.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></article>`).join('')}</div></section>`;
}
function viewLesson(key){
  const i = ALL.findIndex(l => l.key === key); if(i < 0) return viewClassroom();
  const l = ALL[i], m = MODS[l.mi], prev = ALL[i - 1], next = ALL[i + 1];
  return `<section class="sec wrap lesson">
    <a class="back" href="#classroom">← Classroom</a>
    <div class="mute" style="font-size:15px;margin-bottom:6px">${esc(m.title)} · lesson ${l.li + 1} of ${m.lessons.length}</div>
    <h2>${esc(l.title)}</h2>
    ${video(l.video, l.title)}
    <div class="lbody"><p>${esc(l.summary || '')}</p>${l.todo ? `<div class="try"><b>Try it this week</b>${esc(l.todo)}${l.link ? `<br><a class="btn sm" href="${esc(l.link[1])}">${esc(l.link[0])}</a>` : ''}</div>` : ''}</div>
    <div class="lnav">
      <button class="btn ${isDone(l) ? '' : 'pri'}" data-done="${esc(l.key)}">${isDone(l) ? '✓ Done · mark as not done' : 'Mark as done'}</button>
      <span style="display:flex;gap:10px;flex-wrap:wrap">${prev ? `<a class="btn sm" href="#lesson/${encodeURIComponent(prev.key)}">Previous</a>` : ''}${next ? `<a class="btn sm" href="#lesson/${encodeURIComponent(next.key)}">Next lesson</a>` : ''}</span>
    </div></section>`;
}

/* ---------- community ---------- */
function viewCommunity(){
  const K = C.community || {}, inv = /^https:\/\/(discord\.gg|discord\.com)\//.test(K.invite || '') ? K.invite : '';
  return `<section class="cbanner">${courtSvg}<div class="wrap"><div class="cgrid">
      <div><h2>Community</h2><p class="promise" style="max-width:36ch">${esc(K.intro || '')}</p></div>
      <div class="joincard">${inv
        ? `<div><b>Join the free MTC Discord</b><p>Say hi in #introduce-yourself. Already a member? The same button takes you back in.</p><a class="btn pri" href="${esc(inv)}" target="_blank" rel="noopener">Open the Discord</a></div>`
        : `<div><b>The Discord opens soon.</b><p>You’ll get the invite in the newsletter the day it goes live.</p><a class="btn pri" href="${esc(C.substack || '#')}" target="_blank" rel="noopener">Get the newsletter</a></div>`}</div>
    </div></div></section>
    <section class="sec wrap"><div class="cgrid2">
      <div><h3 style="font-size:28px;margin-bottom:14px">What’s inside</h3>${(K.channels || []).map(([n, d]) => `<div class="chan"><span class="hash">#</span><div><b>${esc(n)}</b><p>${esc(d)}</p></div></div>`).join('')}</div>
      <div><h3 style="font-size:28px;margin-bottom:14px">House rules</h3><ol class="rules">${(K.rules || []).map(r => `<li>${esc(r)}</li>`).join('')}</ol>
        <p class="mute" style="font-size:15px;margin-top:22px">Tip: get the Discord app on your phone so you see replies right away.</p></div>
    </div></section>`;
}

/* ---------- router ---------- */
function currentView(){ return decodeURIComponent((location.hash || '#roadmap').slice(1)); }
function route(){
  if(!profile){ renderOnboarding(); return; }
  document.body.classList.remove('onboarding');
  const h = currentView(); let tab = 'roadmap', html;
  if(h.startsWith('lesson/')){ tab = 'classroom'; html = viewLesson(h.slice(7)); }
  else if(h === 'foundation'){ tab = 'foundation'; html = viewFoundation(); }
  else if(h === 'foundation/identity'){ tab = 'foundation'; html = viewIdentity(); }
  else if(h === 'foundation/leading'){ tab = 'foundation'; html = viewLeading(); }
  else if(h === 'journal' || h === 'journal/weekly'){ tab = 'journal'; html = viewJournal(h === 'journal/weekly' ? 'weekly' : 'daily'); }
  else if(h === 'classroom'){ tab = 'classroom'; html = viewClassroom(); }
  else if(h === 'community'){ tab = 'community'; html = viewCommunity(); }
  else { html = viewRoadmap(); }
  app.innerHTML = html;
  document.querySelectorAll('[data-tab]').forEach(a => { if(a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

/* ---------- events ---------- */
function downloadFile(name, text, type){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
document.addEventListener('click', e => {
  if(!profile){ obClick(e); return; }
  const t = e.target;
  if(t.closest('[data-close-rehearse]')){ closeRehearse(); return; }
  const q = sel => t.closest(sel);
  let el;
  if((el = q('[data-done]'))){
    const k = el.dataset.done; if(done[k]) delete done[k]; else done[k] = true; store.set('done', done);
    const was = !!done[k]; route();
    if(was){ const i = ALL.findIndex(l => l.key === k); toast(ALL[i + 1] ? 'Done. Next lesson is ready when you are.' : 'Done. That’s every lesson so far.'); }
    return;
  }
  if((el = q('[data-type]'))){ jtype = el.dataset.type; document.querySelectorAll('[data-type]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === jtype))); return; }
  if((el = q('[data-reh]'))){ rehearsedAns = el.dataset.reh === 'yes'; document.querySelectorAll('[data-reh]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.reh === 'yes') === rehearsedAns))); return; }
  if((el = q('.scale button'))){
    const kind = el.parentElement.dataset.scale, v = +el.dataset.v;
    if(kind === 'present'){ rating = v; document.getElementById('present-desc').textContent = scaleText(PS, v); }
    else { purpose = purpose === v ? null : v; document.getElementById('purpose-desc').textContent = purpose == null ? '' : scaleText(US, purpose); }
    const cur = kind === 'present' ? rating : purpose;
    el.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === cur)));
    return;
  }
  if(q('[data-save-entry]')){
    if(rating == null){ toast('Pick a number from 0 to 10 for how present you were.'); return; }
    const F = focusGoals(), Q = J.questions || [], before = earnedIds();
    const date = (document.getElementById('j-date').value || today());
    const entry = {id: uid(), t: Date.now(), date, type: jtype, rating, purpose, rehearsed: rehearsedAns,
      a: Q.map((_, i) => (document.getElementById('j-q' + i).value || '').trim()),
      g: F.goals.map((g, i) => ({goal: g, answer: ((document.getElementById('j-g' + i) || {}).value || '').trim()}))};
    entries.push(entry);
    if(!store.set('entries', entries)){ entries.pop(); toast('Your browser blocked saving. Try a normal (not private) window.'); return; }
    clearDrafts('q'); clearDrafts('g');
    rating = null; purpose = null; rehearsedAns = null; jdate = null;
    route(); window.scrollTo({top: 0, behavior: 'smooth'});
    announceNewBadges(before, 'Entry saved. See you after the next one.');
    return;
  }
  if((el = q('[data-del]'))){
    if(!el.dataset.sure){ el.dataset.sure = '1'; el.textContent = 'Tap again to delete'; return; }
    entries = entries.filter(x => x.id !== el.dataset.del); store.set('entries', entries); route(); return;
  }
  if(q('[data-export-journal]')){
    const Q = J.questions || [];
    const txt = entries.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(x => `${fmt(x.date)} · ${x.type} · present ${x.rating}/10${x.purpose != null ? ' · purpose ' + x.purpose + '/10' : ''}\n` + Q.map((qq, i) => x.a && x.a[i] ? `${qq}\n${x.a[i]}\n` : '').join('')).join('\n----------\n\n');
    downloadFile('my-tennis-journal.txt', txt, 'text/plain'); return;
  }
  if(q('[data-save-identity]')){
    const text = (document.getElementById('id-text').value || '').trim();
    if(!text){ toast('Write a few lines first.'); return; }
    const before = earnedIds();
    if(identity.versions[0] && identity.versions[0].text === text){ toast('That’s already saved as your latest version.'); return; }
    identity.versions.unshift({id: uid(), date: today(), t: Date.now(), text});
    delete drafts.identity; store.set('draft', drafts); store.set('identity', identity);
    route(); announceNewBadges(before, 'Saved. Come back and sharpen it as you learn more about yourself.');
    return;
  }
  if(q('[data-rehearse]')){
    const ta = document.getElementById('id-text');
    if(ta && ta.value.trim()){ drafts.identity = ta.value; }
    openRehearse(); return;
  }
  if((el = q('[data-restore-version]'))){
    const v = identity.versions.find(x => x.id === el.dataset.restoreVersion);
    if(v){ drafts.identity = v.text; store.set('draft', drafts); route(); window.scrollTo(0, 0); toast('Loaded into the editor. Save it as a new version when you’re done.'); }
    return;
  }
  if((el = q('[data-chip]')) || (el = q('[data-add-phrase]'))){
    let v = el.dataset.chip; if(v == null){ const inp = document.getElementById('phrase-in'); v = (inp.value || '').trim(); }
    if(!v){ toast('Write a sentence first.'); return; }
    if(leading.phrases.includes(v)){ toast('That one is already on your list.'); return; }
    leading.phrases.push(v); store.set('leading', leading); route();
    if(leading.phrases.length === 2) toast('Two sentences in. That step is done.');
    return;
  }
  if((el = q('[data-del-phrase]'))){ leading.phrases.splice(+el.dataset.delPhrase, 1); store.set('leading', leading); route(); return; }
  if((el = q('[data-goal-chip]'))){
    const inputs = [0, 1, 2].map(i => document.querySelector('[data-draft="wg' + i + '"]'));
    const free = inputs.find(x => x && !x.value.trim());
    if(!free){ toast('Your three goal slots are full.'); return; }
    free.value = el.dataset.goalChip; setDraft(free.dataset.draft, free.value); return;
  }
  if(q('[data-save-weekly]')){
    const t0 = today(), ref = weekStart(addDays(t0, -1)), next = addDays(ref, 7), before = earnedIds();
    const a = (J.weeklyQuestions || []).map((_, i) => (document.querySelector('[data-draft="w' + i + '"]').value || '').trim());
    const goals = [0, 1, 2].map(i => (document.querySelector('[data-draft="wg' + i + '"]').value || '').trim()).filter(Boolean);
    if(!a.some(Boolean) && !goals.length){ toast('Write at least one answer or one goal first.'); return; }
    const st = weekStats(ref);
    reflections = reflections.filter(r => r.week !== ref);
    reflections.push({id: uid(), t: Date.now(), week: ref, a, goals, stats: {n: st.n, present: st.present, purpose: st.purpose}});
    plans = plans.filter(p => p.week !== next);
    if(goals.length) plans.push({week: next, goals});
    store.set('reflections', reflections); store.set('plans', plans);
    clearDrafts('w');
    route(); window.scrollTo({top: 0, behavior: 'smooth'});
    announceNewBadges(before, goals.length ? 'Saved. Your goals show up in your journal next week.' : 'Reflection saved.');
    return;
  }
  if(q('[data-hide-install]')){ store.set('hide-install', true); route(); return; }
  if(q('[data-install]') && installEvt){ installEvt.prompt(); installEvt = null; return; }
  if(q('[data-backup]')){
    const data = {}; store.keys().forEach(k => { data[k.slice(PFX.length)] = store.get(k.slice(PFX.length), null); });
    downloadFile('mtc-backup-' + today() + '.json', JSON.stringify({mtc: 'backup', version: 1, data}, null, 2), 'application/json'); return;
  }
  if(q('[data-restore]')){ document.getElementById('restore-file').click(); return; }
  if((el = q('[data-reset]'))){
    if(!el.dataset.sure){ el.dataset.sure = '1'; el.textContent = 'Tap again. This deletes everything on this phone.'; return; }
    store.keys().forEach(k => localStorage.removeItem(k)); reload(); ob = {step: 0, name: '', level: '', goals: [], own: '', change: ''};
    rating = purpose = rehearsedAns = jdate = null; location.hash = '#roadmap'; route(); return;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if(!profile){
    if(t.id === 'ob-name'){ ob.name = t.value; obSync(); }
    else if(t.id === 'ob-own'){ ob.own = t.value; obSync(); }
    else if(t.id === 'ob-change'){ ob.change = t.value; }
    return;
  }
  if(t.id === 'id-text'){ drafts.identity = t.value; clearTimeout(input.t); input.t = setTimeout(() => { store.set('draft', drafts); const s = document.getElementById('id-saved'); if(s) s.textContent = 'Draft saved on this phone.'; }, 400); return; }
  if(t.dataset && t.dataset.draft){ setDraft(t.dataset.draft, t.value); }
});
function input(){}
document.addEventListener('change', e => {
  const t = e.target;
  if(profile && t.id === 'j-date'){ jdate = t.value || today(); rehearsedAns = rehearsedDates[jdate] ? true : rehearsedAns; document.querySelectorAll('[data-reh]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.reh === 'yes') === rehearsedAns && rehearsedAns != null))); }
  if(t.id === 'restore-file' && t.files && t.files[0]){
    const r = new FileReader();
    r.onload = () => {
      try{
        const j = JSON.parse(r.result);
        if(!j || j.mtc !== 'backup' || typeof j.data !== 'object') throw new Error('bad file');
        Object.keys(j.data).forEach(k => store.set(k, j.data[k]));
        reload(); route(); toast('Backup restored.');
      }catch(err){ toast('That file isn’t an MTC backup.'); }
    };
    r.readAsText(t.files[0]); t.value = '';
  }
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !document.getElementById('rehearse').hidden) closeRehearse(); });

/* ---------- start ---------- */
route();
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
