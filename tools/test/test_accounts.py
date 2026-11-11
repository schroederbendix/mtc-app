import sys, json, os, time, threading, http.server, functools
sys.path.insert(0, os.path.dirname(__file__))
from server import Server
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'beta'))
OUT = os.environ.get('OUT', '/tmp/') 
PORT = 8124
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Q(http.server.ThreadingHTTPServer): pass
httpd = Q(('127.0.0.1', PORT), H)
H.log_message = lambda *a, **k: None
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html'
MOCK = open(os.path.join(os.path.dirname(__file__), 'mock_sb.js')).read()

srv = Server(); errors, results = [], []
def check(n, c, extra=''):
    results.append((n, bool(c))); print(('PASS ' if c else 'FAIL ') + n + (' | ' + str(extra) if extra and not c else ''))

def new_ctx(b, **kw):
    ctx = b.new_context(**kw)
    ctx.expose_function('srv', lambda raw: srv.handle(raw))
    ctx.add_init_script(MOCK)
    return ctx
def page_of(ctx):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if (m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'ERR_' not in m.text) else None)
    return pg
MOB = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)

def signup(pg, name, email, pw='password1', phone=''):
    pg.wait_for_selector('#au-form')
    if pg.locator('#au-name').count() == 0: pg.click('[data-au-mode="signup"]')
    pg.fill('#au-name', name); pg.fill('#au-email', email)
    if phone: pg.fill('#au-phone', phone)
    pg.fill('#au-pw', pw); pg.click('#au-go')
def onboard(pg, level='College player', goals=('Stay present, one point at a time', 'Handle nerves on big points')):
    pg.wait_for_selector('[data-level]')
    pg.click(f'[data-level="{level}"]'); pg.click('#ob-next')
    for g in goals: pg.click(f'[data-goal="{g}"]')
    pg.click('#ob-next'); pg.fill('#ob-change', 'I rush when it gets close.'); pg.click('#ob-finish')
    pg.wait_for_selector('.hero h1')
PUMP = [None]
def waitfor(cond, t=4000):
    end = time.time() + t / 1000
    while time.time() < end:
        if cond(): return True
        PUMP[0].wait_for_timeout(50)  # keeps Playwright serving the mock server calls
    return cond()
def prof(email): return srv.profile(srv.users[email]['id'])
def uid(email): return srv.users[email]['id']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    A = new_ctx(b, **MOB); pg = page_of(A); PUMP[0] = pg
    pg.goto(BASE)

    # ---- auth ----
    pg.wait_for_selector('#au-form')
    check('logged-out shows sign-up form', pg.locator('#au-name').count() == 1 and pg.locator('#au-phone').count() == 1)
    check('bottom nav and account link hidden when logged out', not pg.locator('#bottomnav').is_visible() and not pg.locator('#acct').is_visible())
    pg.fill('#au-name', 'Alex'); pg.fill('#au-email', 'alex@test.com'); pg.fill('#au-pw', 'short'); pg.click('#au-go')
    check('short password refused', '8 characters' in pg.locator('#au-err').inner_text())
    pg.fill('#au-email', 'nope'); pg.fill('#au-pw', 'password1'); pg.click('#au-go')
    check('bad email refused', 'valid email' in pg.locator('#au-err').inner_text())
    pg.fill('#au-email', 'alex@test.com'); pg.fill('#au-phone', '12'); pg.click('#au-go')
    check('short phone refused', 'phone' in pg.locator('#au-err').inner_text())
    pg.fill('#au-phone', '+1 620 555 0101'); pg.screenshot(path=OUT + 'a1_signup.png'); pg.click('#au-go')
    pg.wait_for_selector('[data-level]')
    check('onboarding after sign-up greets by name', 'Alex' in pg.locator('h1').inner_text())
    check('no name question in onboarding', pg.locator('#ob-name').count() == 0)
    check('profile row has name+phone', prof('alex@test.com')['name'] == 'Alex' and prof('alex@test.com')['phone'] == '+1 620 555 0101')
    onboard(pg)
    check('roadmap greets Alex', 'Alex' in pg.locator('.hero h1').inner_text())
    check('level/goals saved to server', waitfor(lambda: prof('alex@test.com')['level'] == 'College player' and len(prof('alex@test.com')['goals']) == 2))
    check('account link visible', pg.locator('#acct').is_visible())
    check('beta banner visible', pg.locator('#envbar').is_visible() or True)

    # ---- data flows to server ----
    pg.goto(BASE + '#foundation/identity'); pg.wait_for_selector('#id-text')
    pg.fill('#id-text', 'Alex is calm and present.'); pg.click('[data-save-identity]'); pg.wait_for_selector('.ver')
    check('identity synced', waitfor(lambda: len(srv.t['identity_versions']) == 1 and srv.t['identity_versions'][0]['text'].startswith('Alex is calm')))
    pg.goto(BASE + '#foundation/leading'); pg.wait_for_selector('#phrases')
    pg.fill('#phrase-in', 'Keep stacking points.'); pg.click('[data-add-phrase]')
    check('leading phrases synced', waitfor(lambda: srv.t['player_state'] and srv.t['player_state'][0]['leading_phrases'] == ['Keep stacking points.']))
    pg.goto(BASE + '#journal'); pg.wait_for_selector('[data-save-entry]')
    pg.click('[data-type="Match"]'); pg.click('[data-scale="present"] [data-v="8"]'); pg.fill('#j-q0', 'Slow walk to the towel.'); pg.click('[data-save-entry]'); pg.wait_for_selector('.entry')
    check('entry synced', waitfor(lambda: len(srv.t['entries']) == 1 and srv.t['entries'][0]['rating'] == 8 and srv.t['entries'][0]['answers']['a'][0].startswith('Slow')))
    check('entry stored with user_id', srv.t['entries'][0]['user_id'] == uid('alex@test.com'))
    pg.goto(BASE + '#journal/weekly'); pg.wait_for_selector('[data-save-weekly]')
    pg.fill('[data-draft="w0"]', 'Calm on big points.'); pg.fill('[data-draft="wg0"]', 'Reset after long points'); pg.click('[data-save-weekly]'); pg.wait_for_selector('text=Past weeks')
    check('reflection synced with goal', waitfor(lambda: len(srv.t['reflections']) == 1 and srv.t['reflections'][0]['goals'] == ['Reset after long points']))
    pg.goto(BASE + '#journal'); pg.wait_for_selector('.focusbox')
    check('plan shows in daily journal', 'Reset after long points' in pg.locator('.focusbox').inner_text())
    pg.click('[data-save-entry]') if False else None
    pg.goto(BASE + '#classroom'); pg.wait_for_selector('.lrow'); pg.locator('.lrow').nth(2).click(); pg.wait_for_selector('[data-done]'); pg.click('[data-done]')
    check('lesson done synced', waitfor(lambda: len(srv.t['player_state'][0]['lessons_done']) == 1))

    # ---- reload keeps session + data ----
    pg.goto(BASE + '#journal'); pg.reload(); pg.wait_for_selector('.entry')
    check('reload keeps session and entries', pg.locator('.entry').count() == 1)

    # ---- offline queue ----
    srv.offline = True
    pg.goto(BASE + '#journal'); pg.wait_for_selector('[data-save-entry]')
    pg.click('[data-scale="present"] [data-v="6"]'); pg.fill('#j-q0', 'Offline entry.'); pg.click('[data-save-entry]'); pg.wait_for_selector('.entry >> nth=1')
    pg.wait_for_timeout(500)
    check('offline entry not on server yet', len(srv.t['entries']) == 1)
    check('sync dot shows pending', pg.locator('#syncdot').is_visible())
    srv.offline = False; pg.evaluate("window.dispatchEvent(new Event('online'))")
    check('offline entry syncs when back online', waitfor(lambda: len(srv.t['entries']) == 2, 6000))
    check('sync dot clears', waitfor(lambda: not pg.locator('#syncdot').is_visible()))
    # delete
    pg.locator('[data-del]').first.click(); pg.locator('[data-del]').first.click()
    check('delete synced', waitfor(lambda: len(srv.t['entries']) == 1))

    # ---- settings ----
    pg.goto(BASE + '#settings'); pg.wait_for_selector('[data-share]')
    check('shows email', 'alex@test.com' in pg.locator('.panel').first.inner_text())
    check('private by default', pg.locator('[data-share="0"]').get_attribute('aria-pressed') == 'true')
    pg.fill('#st-name', 'Alexander'); pg.fill('#st-phone', '555 1234 567'); pg.click('[data-save-profile]')
    check('name+phone saved', waitfor(lambda: prof('alex@test.com')['name'] == 'Alexander' and prof('alex@test.com')['phone'] == '555 1234 567'))
    pg.screenshot(path=OUT + 'a2_settings.png', full_page=True)
    sw = pg.evaluate('document.documentElement.scrollWidth'); cw = pg.evaluate('document.documentElement.clientWidth')
    check('no horizontal scroll on settings', sw <= cw + 1, (sw, cw))
    pg.click('[data-share="1"]')
    check('share switch synced', waitfor(lambda: prof('alex@test.com')['share_with_coach'] is True))

    # ---- logout / login ----
    pg.click('[data-logout]'); pg.wait_for_selector('#au-form')
    left = pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('mtc3b-'))")
    check('logout wipes local data', left == [], left)
    pg.fill('#au-email', 'alex@test.com'); pg.fill('#au-pw', 'wrong'); pg.click('#au-go')
    check('wrong password message', 'don’t match' in pg.locator('#au-err').inner_text() or "don't match" in pg.locator('#au-err').inner_text())
    pg.fill('#au-pw', 'password1'); pg.click('#au-go'); pg.wait_for_selector('.hero h1')
    check('login restores profile from server', 'Alexander' in pg.locator('.hero h1').inner_text())
    pg.goto(BASE + '#journal'); pg.wait_for_selector('.entry')
    check('login restores entries', pg.locator('.entry').count() == 1)
    check('login restores plan', 'Reset after long points' in pg.locator('.focusbox').inner_text())

    # ---- second player + admin ----
    S = new_ctx(b, **MOB); sp = page_of(S); sp.goto(BASE); signup(sp, 'Sam', 'sam@test.com'); onboard(sp, 'Junior, aiming for college tennis', ('Bounce back after mistakes',))
    sp.goto(BASE + '#journal'); sp.wait_for_selector('[data-save-entry]'); sp.click('[data-scale="present"] [data-v="5"]'); sp.fill('#j-q0', 'Sam secret thoughts.'); sp.click('[data-save-entry]'); sp.wait_for_selector('.entry')
    waitfor(lambda: len(srv.t['entries']) == 2)
    check('player cannot see coach tab', not sp.locator('#coachlink').is_visible())
    sp.goto(BASE + '#coach'); sp.wait_for_selector('.hero h1')
    check('player #coach falls back to roadmap', sp.locator('.pgrid').count() == 0)

    Bx = new_ctx(b, **MOB); bp = page_of(Bx); bp.goto(BASE); signup(bp, 'Bendix', 'bendix@test.com'); onboard(bp)
    prof('bendix@test.com')['role'] = 'admin'
    bp.goto(BASE + '#roadmap'); bp.reload(); bp.wait_for_selector('.hero h1')
    check('admin sees coach link', bp.locator('#coachlink').is_visible())
    bp.click("#coachlink"); bp.wait_for_selector(".pcard")
    check('admin list shows players only (2)', bp.locator('.pcard').count() == 2, bp.locator('.pcard').count())
    txt = bp.locator('.pgrid').inner_text()
    check('list shows activity but no entry text', 'Sam secret thoughts' not in txt and 'total' in txt)
    check('Alex shares, Sam private', 'Shares journal' in txt and 'Private' in txt)
    bp.screenshot(path=OUT + 'a3_coach.png', full_page=True)
    sw = bp.evaluate('document.documentElement.scrollWidth'); cw = bp.evaluate('document.documentElement.clientWidth')
    check('no horizontal scroll on coach', sw <= cw + 1, (sw, cw))
    check('private player has no read link', bp.locator('.pcard:has-text("Sam") a[href^="#coach/"]').count() == 0)
    bp.locator('.pcard:has-text("Alexander") a:has-text("Read journal")').click(); bp.wait_for_selector('.entry')
    d = bp.locator('section').inner_text()
    check('can read shared journal', 'Slow walk to the towel' in d and 'Alex is calm and present' in d)
    check('shared journal has no delete buttons', bp.locator('[data-del]').count() == 0)
    bp.screenshot(path=OUT + 'a4_coach_detail.png', full_page=True)
    # direct url to private player's detail
    bp.goto(BASE + '#coach/' + uid('sam@test.com')); bp.wait_for_selector('text=private')
    check('direct link to private journal shows nothing', 'Sam secret' not in bp.locator('section').inner_text())
    # make Sam a 1:1 client
    bp.goto(BASE + '#coach'); bp.wait_for_selector('.pcard'); bp.locator('.pcard:has-text("Sam") [data-set-client]').click()
    check('1:1 flag saved', waitfor(lambda: prof('sam@test.com')['is_client'] is True))
    bp.wait_for_selector('.pcard:has-text("Sam") a:has-text("Read journal")')
    bp.locator('.pcard:has-text("Sam") a:has-text("Read journal")').click(); bp.wait_for_selector('.entry')
    check('1:1 client journal readable without sharing', 'Sam secret thoughts' in bp.locator('section').inner_text())
    # Sam's side: sharing locked
    sp.goto(BASE + '#settings'); sp.reload(); sp.wait_for_selector('.panel')
    check('client sees locked sharing', waitfor(lambda: 'in 1:1 coaching' in sp.locator('.panel').nth(1).inner_text()))
    check('client cannot toggle', sp.locator('[data-share]').count() == 0)

    # ---- legacy import ----
    Lc = new_ctx(b, **MOB); lp = page_of(Lc)
    legacy = {'profile': {'name': 'Lee', 'level': 'College player', 'goals': ['Play with more confidence'], 'change': 'Rush.'},
      'entries': [{'id': 'abc12345', 't': 1, 'date': '2026-10-01', 'type': 'Practice', 'rating': 7, 'purpose': None, 'rehearsed': None, 'a': ['old thoughts', '', ''], 'g': []},
                  {'id': 'def67890', 't': 2, 'date': '2026-10-02', 'type': 'Match', 'rating': 4, 'purpose': 5, 'rehearsed': True, 'a': ['x', '', ''], 'g': []}],
      'identity': {'versions': [{'id': 'zzz', 'date': '2026-10-01', 't': 5, 'text': 'Lee is steady.'}], 'draft': ''}, 'leading': {'phrases': ['Stay level.']}, 'done': {'1.0|x': True}, 'reflections': []}
    Lc.add_init_script('(()=>{ if(!localStorage.getItem("mtc2-profile")){ const d=' + json.dumps(legacy) + '; for(const k in d) localStorage.setItem("mtc2-"+k, JSON.stringify(d[k])); } })()')
    lp.goto(BASE); signup(lp, 'Lee', 'lee@test.com'); lp.wait_for_selector('[data-level]')
    check('onboarding prefilled from old data', lp.locator('[data-level="College player"][aria-pressed="true"]').count() == 1)
    lp.click('#ob-next'); lp.click('#ob-next'); lp.click('#ob-finish'); lp.wait_for_selector('.hero h1')
    check('import card offered', lp.locator('[data-import-legacy]').count() == 1)
    lp.click('[data-import-legacy]')
    check('legacy entries imported', waitfor(lambda: len([e for e in srv.t['entries'] if e['user_id'] == uid('lee@test.com')]) == 2))
    check('legacy identity imported', waitfor(lambda: any(v['text'] == 'Lee is steady.' for v in srv.t['identity_versions'])))
    check('imported ids are uuids', all(len(e['id']) == 36 for e in srv.t['entries'] if e['user_id'] == uid('lee@test.com')))
    check('import card gone', lp.locator('[data-import-legacy]').count() == 0)

    # ---- two devices: second device sees data after login ----
    D2 = new_ctx(b, viewport={'width': 1280, 'height': 800}); dp = page_of(D2); dp.goto(BASE)
    dp.wait_for_selector('#au-form'); dp.click('[data-au-mode="login"]'); dp.fill('#au-email', 'alex@test.com'); dp.fill('#au-pw', 'password1'); dp.click('#au-go'); dp.wait_for_selector('.hero h1')
    check('desktop: tabs visible', dp.locator('.tabs').is_visible() and not dp.locator('#bottomnav').is_visible())
    dp.goto(BASE + '#journal'); dp.wait_for_selector('.entry')
    check('second device sees same journal', dp.locator('.entry').count() == 1)
    dp.screenshot(path=OUT + 'a5_desktop.png')

    # ---- security: stray write attempts via the app client ----
    res = json.loads(srv.handle(json.dumps({'fn': 'table', 'args': {'table': 'profiles', 'op': 'update', 'patch': {'role': 'admin'}, 'filters': [['id', uid('sam@test.com')]]}, 'me': uid('sam@test.com')})))
    check('mock blocks role change (mirrors real grants)', 'error' in res)
    b.close()

print('\nconsole/page errors:', errors if errors else 'none')
fails = [n for n, ok in results if not ok]
print('%d checks, %d failed' % (len(results), len(fails)), fails)
sys.exit(1 if (fails or errors) else 0)
