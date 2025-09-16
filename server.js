require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin(origin, cb){
    if (!origin) return cb(null, true); // file:// trong dev
    if (ALLOWED_ORIGIN === '*' || origin === ALLOWED_ORIGIN) return cb(null, true);
    cb(new Error('CORS blocked: ' + origin));
  }
}));

const projFile = path.join(__dirname, 'sections', 'projects.html');

function readProjectsHTML(){
  if (!fs.existsSync(projFile)) return '';
  return fs.readFileSync(projFile, 'utf8');
}
function writeProjectsHTML(raw){
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'section','article','div','span','h1','h2','h3','h4','h5','h6','p','ul','ol','li',
      'a','img','button','small','strong','em','i','b','svg','path','figure','figcaption'
    ],
    ALLOWED_ATTR: [
      'class','id','href','target','rel','alt','src','loading','data-aos','style',
      'aria-label','role','title','viewBox','d'
    ],
    FORBID_TAGS: ['script'],
    FORBID_ATTR: [/^on/i]
  });
  fs.writeFileSync(projFile, clean, 'utf8');
  return clean;
}

app.get('/api/sections/projects', (_req, res) => {
  res.json({ ok:true, html: readProjectsHTML() });
});

app.post('/api/sections/projects', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'').trim();
  if (token !== ADMIN_TOKEN) return res.status(401).json({ ok:false, error:'unauthorized' });

  const { html } = req.body || {};
  if (typeof html !== 'string') return res.status(400).json({ ok:false, error:'html_required' });

  try {
    const clean = writeProjectsHTML(html);
    res.json({ ok:true, savedBytes: Buffer.byteLength(clean, 'utf8') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'write_failed' });
  }
});

app.listen(PORT, () => console.log('API http://localhost:'+PORT));
