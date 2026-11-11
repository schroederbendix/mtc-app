"""Python stand-in for the Supabase backend, enforcing the same sharing rules as the real RLS."""
import json, uuid, datetime

class Server:
    def __init__(self):
        self.users = {}      # email -> dict(id, pw)
        self.t = {k: [] for k in ['profiles', 'entries', 'reflections', 'identity_versions', 'player_state']}
        self.offline = False
        self.log = []

    def profile(self, uid):
        return next((p for p in self.t['profiles'] if p['id'] == uid), None)

    def is_admin(self, me):
        p = self.profile(me); return bool(p and p['role'] == 'admin')

    def can_read(self, me, uid):
        if me == uid: return True
        p = self.profile(uid)
        return bool(self.is_admin(me) and p and (p['share_with_coach'] or p['is_client']))

    def handle(self, raw):
        if self.offline: raise RuntimeError('offline')
        req = json.loads(raw); fn, a, me = req['fn'], req.get('args') or {}, req['me']
        self.log.append((fn, a if fn != 'signUp' and fn != 'signIn' else '...'))
        try:
            return json.dumps(self._do(fn, a, me))
        except Exception as e:
            return json.dumps({'error': {'message': str(e), 'code': 'X'}})

    def _session(self, email):
        u = self.users[email]; return {'user': {'id': u['id'], 'email': email}}

    def _do(self, fn, a, me):
        if fn == 'signUp':
            email = a['email']
            if email in self.users: raise Exception('User already registered')
            if len(a['password']) < 6: raise Exception('Password should be at least 6 characters')
            uid = str(uuid.uuid4()); self.users[email] = {'id': uid, 'pw': a['password']}
            meta = (a.get('options') or {}).get('data') or {}
            self.t['profiles'].append({'id': uid, 'name': meta.get('name', ''), 'phone': meta.get('phone', ''), 'level': '', 'goals': [], 'change_note': '',
                'share_with_coach': False, 'is_client': False, 'role': 'player', 'plan': 'founder', 'joined_at': datetime.datetime.utcnow().isoformat() + 'Z'})
            return {'data': {'session': self._session(email)}, 'error': None}
        if fn == 'signIn':
            u = self.users.get(a['email'])
            if not u or u['pw'] != a['password']: raise Exception('Invalid login credentials')
            return {'data': {'session': self._session(a['email'])}, 'error': None}
        if fn == 'rpc:admin_players':
            if not self.is_admin(me): raise Exception('not allowed')
            out = []
            for p in self.t['profiles']:
                if p['role'] != 'player': continue
                E = [e for e in self.t['entries'] if e['user_id'] == p['id']]
                recent = [e for e in E if e['date'] >= (datetime.date.today() - datetime.timedelta(days=6)).isoformat()]
                out.append({**{k: p[k] for k in ['id', 'name', 'phone', 'level', 'plan', 'joined_at', 'share_with_coach', 'is_client']},
                            'entries_total': len(E), 'entries_7d': len(recent), 'last_entry': max([e['date'] for e in E], default=None)})
            return {'data': out, 'error': None}
        if fn == 'rpc:admin_set_client':
            if not self.is_admin(me): raise Exception('not allowed')
            self.profile(a['uid'])['is_client'] = a['val']; return {'data': None, 'error': None}
        if fn == 'table':
            tb = a['table']; rows = self.t[tb]
            if not me: raise Exception('permission denied')
            ownkey = 'id' if tb == 'profiles' else 'user_id'
            if a['op'] == 'select':
                f = dict(a['filters']); out = []
                for r in rows:
                    if all(r.get(c) == v for c, v in f.items()) and self.can_read(me, r[ownkey]): out.append(r)
                return {'data': out, 'error': None}
            if a['op'] == 'upsert':
                row = dict(a['row']); row['user_id'] = me
                if row.get('user_id') != me: raise Exception('rls')
                keys = (a.get('opts') or {}).get('onConflict', 'id').split(',')
                ex = next((r for r in rows if all(r.get(k) == row.get(k) for k in keys)), None)
                if ex:
                    if ex['user_id'] != me: raise Exception('rls')
                    ex.update(row)
                else: rows.append(row)
                return {'data': None, 'error': None}
            if a['op'] in ('update', 'delete'):
                f = dict(a['filters']); n = 0
                for r in list(rows):
                    if all(r.get(c) == v for c, v in f.items()) and r[ownkey] == me:
                        if a['op'] == 'delete': rows.remove(r)
                        else:
                            allowed = {'name', 'phone', 'level', 'goals', 'change_note', 'share_with_coach'}
                            if tb != 'profiles' or not set(a['patch']) <= allowed: raise Exception('permission denied for table ' + tb)
                            r.update(a['patch'])
                        n += 1
                return {'data': None, 'error': None}
        raise Exception('unknown ' + fn)
