import { type FastifyPluginAsync } from 'fastify';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PDF App Generator</title>
    <link rel="stylesheet" href="/ui/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="brand">PDF App Generator</div>
      <nav class="nav">
        <a href="/docs" target="_blank" rel="noreferrer">API Docs</a>
      </nav>
    </header>

    <main class="container">
      <section class="card" id="auth">
        <h2>Sign in / Register</h2>
        <div class="row">
          <input id="email" placeholder="email" />
          <input id="password" placeholder="password" type="password" />
        </div>
        <div class="row">
          <button id="register">Register</button>
          <button id="login">Login</button>
        </div>
        <p class="hint">This is a minimal UI shell. Use the Swagger UI for full API testing.</p>
      </section>

      <section class="card hidden" id="app">
        <div class="row space">
          <h2>Dashboard</h2>
          <button id="logout">Logout</button>
        </div>

        <div class="row">
          <input id="docTitle" placeholder="Document title" />
          <select id="format">
            <option value="plain">Plain</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
        </div>
        <textarea id="docContent" placeholder="Write content here..."></textarea>
        <div class="row">
          <button id="createDoc">Create document</button>
        </div>

        <h3>Your documents</h3>
        <div id="docs"></div>
      </section>
    </main>

    <script type="module" src="/ui/app.js"></script>
  </body>
</html>`;

const css = `
:root { --bg:#0b1220; --card:#101a2f; --text:#e8eefc; --muted:#9fb0d0; --accent:#5b8cff; }
*{ box-sizing:border-box; }
body{ margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:var(--bg); color:var(--text); }
.topbar{ display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,.08); }
.brand{ font-weight:700; letter-spacing:.2px; }
.nav a{ color:var(--muted); text-decoration:none; }
.container{ max-width:980px; margin:0 auto; padding:18px; }
.card{ background:var(--card); border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:16px; }
.row{ display:flex; gap:10px; margin:10px 0; flex-wrap:wrap; }
.row.space{ justify-content:space-between; align-items:center; }
input, select, textarea{ width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:#0c1426; color:var(--text); }
textarea{ min-height:140px; }
button{ padding:10px 14px; border-radius:10px; border:0; background:var(--accent); color:white; cursor:pointer; }
button:hover{ filter:brightness(1.05); }
.hint{ color:var(--muted); font-size:13px; }
.hidden{ display:none; }
.doc{ display:flex; gap:10px; align-items:center; justify-content:space-between; padding:10px; border-radius:12px; background:#0c1426; border:1px solid rgba(255,255,255,.08); margin-top:10px; }
.doc .meta{ display:flex; flex-direction:column; gap:2px; }
.doc .meta .small{ color:var(--muted); font-size:12px; }
.doc .actions{ display:flex; gap:8px; }
`;

const js = `let token = null;

function $(id){ return document.getElementById(id); }

async function api(path, opts={}){
  const headers = opts.headers ? { ...opts.headers } : {};
  if (token) headers['authorization'] = 'Bearer ' + token;
  if (opts.body && !headers['content-type']) headers['content-type'] = 'application/json';
  const res = await fetch(path, { ...opts, headers });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
  return data;
}

async function refreshDocs(){
  const out = await api('/v1/documents');
  const root = $('docs');
  root.innerHTML = '';
  for (const d of out.items){
    const el = document.createElement('div');
    el.className = 'doc';
    el.innerHTML =
      '<div class="meta">' +
        '<div><strong>' + d.title + '</strong></div>' +
        '<div class="small">' + d.id + '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button>Download PDF</button>' +
      '</div>';
    el.querySelector('button').addEventListener('click', () => {
      window.location.href = '/v1/documents/' + d.id + '/download';
    });
    root.appendChild(el);
  }
}

function showApp(){ $('auth').classList.add('hidden'); $('app').classList.remove('hidden'); }
function showAuth(){ $('app').classList.add('hidden'); $('auth').classList.remove('hidden'); }

$('register').addEventListener('click', async () => {
  const email = $('email').value;
  const password = $('password').value;
  const res = await api('/v1/auth/register', { method:'POST', body: JSON.stringify({ email, password }) });
  token = res.accessToken;
  showApp();
  await refreshDocs();
});

$('login').addEventListener('click', async () => {
  const email = $('email').value;
  const password = $('password').value;
  const res = await api('/v1/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
  token = res.accessToken;
  showApp();
  await refreshDocs();
});

$('logout').addEventListener('click', async () => {
  token = null;
  showAuth();
});

$('createDoc').addEventListener('click', async () => {
  const title = $('docTitle').value || 'Untitled';
  const content = $('docContent').value || '';
  const contentFormat = $('format').value;
  await api('/v1/documents', { method:'POST', body: JSON.stringify({ title, content, contentFormat }) });
  $('docTitle').value = '';
  $('docContent').value = '';
  await refreshDocs();
});
`;

export const uiRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    reply.type('text/html; charset=utf-8');
    return reply.send(html);
  });

  app.get('/ui/styles.css', async (_req, reply) => {
    reply.type('text/css; charset=utf-8');
    return reply.send(css);
  });

  app.get('/ui/app.js', async (_req, reply) => {
    reply.type('text/javascript; charset=utf-8');
    return reply.send(js);
  });
};
