require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

/** ALLOWED_ORIGIN: cho phép nhiều origin, ngăn cách bằng dấu phẩy
 *  Ví dụ:
 *  ALLOWED_ORIGIN=https://dong065vn.github.io, http://127.0.0.1:5500, http://localhost:5500
 */
const ORIGIN_LIST = (process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(express.json({ limit: '2mb' }));

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // file:// hoặc curl
    if (ORIGIN_LIST.includes('*')) return cb(null, true);
    if (ORIGIN_LIST.includes(origin)) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  }
}));

// ====== Helpers: chọn đường dẫn ghi/đọc, fallback /tmp nếu cần ======
const primaryDir = path.resolve(__dirname, 'sections');
const tmpDir = path.join(process.env.RUNTIME_TMPDIR || '/tmp', 'sections');
const primaryFile = path.join(primaryDir, 'projects.html');
const tmpFile = path.join(tmpDir, 'projects.html');

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
  await fsp.access(dirPath, fs.constants.W_OK);
  return dirPath;
}

/** Trả về đường dẫn file có thể ghi */
async function getWritableFilePath() {
  try {
    await ensureDir(primaryDir);
    return primaryFile;
  } catch {
    await ensureDir(tmpDir);
    return tmpFile;
  }
}

/** Trả về đường dẫn file hiện có để đọc (ưu tiên primary) */
async function getReadableFilePath() {
  try {
    await fsp.access(primaryFile, fs.constants.F_OK);
    return primaryFile;
  } catch {
    return tmpFile;
  }
}

function sanitizeHTML(raw) {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'section','article','div','span','h1','h2','h3','h4','h5','h6','p','ul','ol','li',
      'a','img','button','small','strong','em','i','b','svg','path','figure','figcaption'
    ],
    ALLOWED_ATTR: [
      'class','id','href','target','rel','alt','src','loading','data-aos','style',
      'aria-label','role','title','viewBox','d','data-aos-delay'
    ],
    FORBID_TAGS: ['script'],
    FORBID_ATTR: [/^on/i]
  });
}

// ====== API: GET/POST sections/projects ======
app.get('/api/sections/projects', async (_req, res) => {
  try {
    const file = await getReadableFilePath();
    const html = await fsp.readFile(file, 'utf8').catch(() => '');
    res.json({ ok: true, html, source: file });
  } catch (e) {
    console.error('read_failed', e);
    res.status(500).json({ ok: false, error: 'read_failed' });
  }
});

app.post('/api/sections/projects', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const { html } = req.body || {};
    if (typeof html !== 'string') return res.status(400).json({ ok: false, error: 'html_required' });

    const file = await getWritableFilePath();
    const clean = sanitizeHTML(html);
    await fsp.writeFile(file, clean, 'utf8');
    res.json({
      ok: true,
      saved: file,
      bytes: Buffer.byteLength(clean, 'utf8')
    });
  } catch (e) {
    console.error('write_failed', e);
    res.status(500).json({ ok: false, error: 'write_failed' });
  }
});

// ====== Proxy fetch (import từ Web B/GitHub Pages) ======
const ALLOWED_FETCH_HOSTS = new Set([
  'localhost', '127.0.0.1',
  'dong065vn.github.io' // đổi/ thêm domain khác nếu cần
]);

app.get('/api/proxy/fetch', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ ok: false, error: 'url_required' });

    const u = new URL(url);
    if (!ALLOWED_FETCH_HOSTS.has(u.hostname)) {
      return res.status(400).json({ ok: false, error: 'host_not_allowed' });
    }

    const r = await fetch(u.toString(), { redirect: 'follow' });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'upstream_' + r.status });

    const html = await r.text();
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    console.error('fetch_failed', e);
    res.status(500).json({ ok: false, error: 'fetch_failed' });
  }
});

app.listen(PORT, () => console.log(`API listening on :${PORT}`));
