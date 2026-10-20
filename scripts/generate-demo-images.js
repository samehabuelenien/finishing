/**
 * يولّد صورًا توضيحية (Demo) لمساحات داخلية بأسلوب الرسم المعماري.
 * هذه الصور ليست مشاريع حقيقية للشركة — هي بدائل مؤقتة تُستبدل من لوحة التحكم.
 * التشغيل: npm run demo:images
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1600, H = 1100;
const VP = { x: 800, y: 500 };
const BW = { x0: 420, x1: 1180, y0: 230, y1: 760 }; // الجدار الخلفي
const OUT = path.join(__dirname, '..', 'public', 'img', 'demo');

const toVP = (p, t) => ({ x: p.x + (VP.x - p.x) * t, y: p.y + (VP.y - p.y) * t });
const pts = (arr) => arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

// صندوق في منظور نقطة واحدة: الوجه الأمامي مستطيل، والعمق نسبة الاقتراب من نقطة التلاشي
function box(x, y, w, h, t, c) {
  const f = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const b = f.map((p) => toVP(p, t));
  let s = '';
  if (y > VP.y) s += `<polygon points="${pts([f[0], f[1], b[1], b[0]])}" fill="${c.top || c.side}"/>`;
  if (y + h < VP.y) s += `<polygon points="${pts([f[3], f[2], b[2], b[3]])}" fill="${c.bottom || c.side}"/>`;
  if (x > VP.x) s += `<polygon points="${pts([f[0], f[3], b[3], b[0]])}" fill="${c.side}"/>`;
  if (x + w < VP.x) s += `<polygon points="${pts([f[1], f[2], b[2], b[1]])}" fill="${c.side}"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.front}"/>`;
  return s;
}
const shadow = (cx, cy, rx, ry, o = 0.35) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${o}" filter="url(#blur)"/>`;

function floorTiles(color, n = 9, rows = 7, op = 0.18) {
  let s = '';
  const k = (H - VP.y) / (BW.y1 - VP.y);
  for (let i = -n; i <= n * 2; i++) {
    const x = BW.x0 + ((BW.x1 - BW.x0) / n) * i;
    const xb = VP.x + (x - VP.x) * k;
    if (xb < -2000 || xb > W + 2000) continue;
    s += `<line x1="${x}" y1="${BW.y1}" x2="${xb}" y2="${H}" stroke="${color}" stroke-width="2" opacity="${op}"/>`;
  }
  for (let r = 1; r <= rows; r++) {
    const d = 1 + r * 0.55;
    const y = VP.y + (BW.y1 - VP.y) * d;
    if (y > H) break;
    s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${color}" stroke-width="2" opacity="${op}"/>`;
  }
  return s;
}
function woodFloor(color, op = 0.14) {
  let s = '';
  const k = (H - VP.y) / (BW.y1 - VP.y);
  for (let i = -30; i <= 60; i++) {
    const x = BW.x0 + 24 * i;
    const xb = VP.x + (x - VP.x) * k;
    s += `<line x1="${x}" y1="${BW.y1}" x2="${xb}" y2="${H}" stroke="${color}" stroke-width="1.6" opacity="${op}"/>`;
  }
  return s;
}

function shell(p) {
  return `
  <polygon points="0,0 ${W},0 ${BW.x1},${BW.y0} ${BW.x0},${BW.y0}" fill="url(#ceil)"/>
  <polygon points="0,0 ${BW.x0},${BW.y0} ${BW.x0},${BW.y1} 0,${H}" fill="url(#lwall)"/>
  <polygon points="${W},0 ${BW.x1},${BW.y0} ${BW.x1},${BW.y1} ${W},${H}" fill="url(#rwall)"/>
  <rect x="${BW.x0}" y="${BW.y0}" width="${BW.x1 - BW.x0}" height="${BW.y1 - BW.y0}" fill="url(#bwall)"/>
  <polygon points="${BW.x0},${BW.y1} ${BW.x1},${BW.y1} ${W},${H} 0,${H}" fill="url(#floor)"/>`;
}

function defs(p) {
  return `<defs>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
    <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.ceil[0]}"/><stop offset="1" stop-color="${p.ceil[1]}"/></linearGradient>
    <linearGradient id="lwall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.side[0]}"/><stop offset="1" stop-color="${p.side[1]}"/></linearGradient>
    <linearGradient id="rwall" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${p.side[0]}"/><stop offset="1" stop-color="${p.side[1]}"/></linearGradient>
    <linearGradient id="bwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.back[0]}"/><stop offset="1" stop-color="${p.back[1]}"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.floor[0]}"/><stop offset="1" stop-color="${p.floor[1]}"/></linearGradient>
    <radialGradient id="light" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6e3" stop-opacity="0.85"/><stop offset="1" stop-color="#fff6e3" stop-opacity="0"/></radialGradient>
    <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ea"/><stop offset="1" stop-color="#f3efe6"/></linearGradient>
    <linearGradient id="marble" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f1ec"/><stop offset="0.5" stop-color="#e6e1d9"/><stop offset="1" stop-color="#f7f5f1"/></linearGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="0.8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>
  </defs>`;
}

// خطوط إضاءة مخفية في سقف الجبس
function coveCeiling(color = '#ffd9a0') {
  const a = toVP({ x: 0, y: 0 }, 0.55), b = toVP({ x: W, y: 0 }, 0.55);
  return `<polygon points="${pts([{ x: 120, y: 0 }, { x: W - 120, y: 0 }, b, a])}" fill="#000" opacity="0.06"/>
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="6" opacity="0.9" filter="url(#glow)"/>
    <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#fff3dc" stroke-width="2"/>`;
}
function spots(n = 4, y = 80) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 300 + ((W - 600) / (n - 1)) * i;
    const p = toVP({ x, y }, 0.35);
    s += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#fff8e8"/><circle cx="${p.x}" cy="${p.y}" r="22" fill="url(#light)"/>`;
  }
  return s;
}
function pendant(x, len, r = 34, color = '#B8925A') {
  return `<line x1="${x}" y1="${BW.y0 - 60}" x2="${x}" y2="${BW.y0 + len}" stroke="#2a2a2a" stroke-width="2"/>
    <path d="M${x - r},${BW.y0 + len + r * 0.8} A${r},${r} 0 0 1 ${x + r},${BW.y0 + len + r * 0.8} Z" fill="${color}"/>
    <ellipse cx="${x}" cy="${BW.y0 + len + r * 1.1}" rx="${r * 2}" ry="${r}" fill="url(#light)"/>`;
}
function windowLeft() {
  // نافذة على الجدار الأيسر
  const tl = toVP({ x: 0, y: 140 }, 0.18), tr = toVP({ x: 0, y: 140 }, 0.62);
  const bl = toVP({ x: 0, y: 980 }, 0.18), br = toVP({ x: 0, y: 980 }, 0.62);
  const m1 = toVP({ x: 0, y: 140 }, 0.4), m2 = toVP({ x: 0, y: 980 }, 0.4);
  return `<polygon points="${pts([tl, tr, br, bl])}" fill="url(#win)"/>
    <line x1="${m1.x}" y1="${m1.y}" x2="${m2.x}" y2="${m2.y}" stroke="#2b2b2b" stroke-width="5"/>
    <polygon points="${pts([tl, tr, br, bl])}" fill="none" stroke="#2b2b2b" stroke-width="6"/>
    <polygon points="${pts([bl, br, { x: 700, y: 1100 }, { x: 180, y: 1100 }])}" fill="#fff4dc" opacity="0.18"/>`;
}
function slats(x0, x1, y0, y1, c1, c2, step = 22) {
  let s = `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${c1}"/>`;
  for (let x = x0 + step / 2; x < x1; x += step) s += `<rect x="${x}" y="${y0}" width="${step / 2.6}" height="${y1 - y0}" fill="${c2}" opacity="0.55"/>`;
  return s;
}
function plant(x, y, sc = 1) {
  return `<g transform="translate(${x},${y}) scale(${sc})">
    <path d="M-28,0 L28,0 L22,70 L-22,70 Z" fill="#d8d0c4"/>
    <path d="M0,0 C-40,-60 -90,-80 -100,-150 C-40,-120 -10,-70 0,0" fill="#5d7a5a"/>
    <path d="M0,0 C30,-70 80,-90 90,-170 C30,-130 5,-80 0,0" fill="#6f8f69"/>
    <path d="M0,0 C-5,-80 -20,-140 0,-210 C20,-140 8,-80 0,0" fill="#4e6a4c"/></g>`;
}
function art(x, y, w, h, colors) {
  return `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="#1c1c1c"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[0]}"/>
    <circle cx="${x + w * 0.62}" cy="${y + h * 0.42}" r="${Math.min(w, h) * 0.24}" fill="${colors[1]}"/>
    <rect x="${x}" y="${y + h * 0.68}" width="${w}" height="${h * 0.32}" fill="${colors[2]}"/>`;
}

const scenes = {
  'living-luxe': () => {
    const p = { ceil: ['#efe9df', '#f7f3ec'], side: ['#d9cfc0', '#ece4d8'], back: ['#e9e1d4', '#ddd2c2'], floor: ['#cdbca4', '#a98f6e'] };
    return { p, body: shell(p) + woodFloor('#5a4430') + coveCeiling() + spots(4) + windowLeft() +
      slats(560, 1040, BW.y0, BW.y1, '#8a6a4a', '#5b4330') +
      `<rect x="640" y="430" width="320" height="180" fill="#121315"/><rect x="646" y="436" width="308" height="168" fill="#1b1e22"/>` +
      box(600, 640, 400, 52, 0.12, { front: '#2a2b2e', top: '#3a3b3f', side: '#1c1d1f' }) +
      `<polygon points="200,1100 1400,1100 1130,850 470,850" fill="#e8e0d2" opacity="0.92"/>` +
      shadow(800, 1000, 520, 50) +
      box(330, 860, 940, 120, 0.1, { front: '#d8cbb6', top: '#e8dccb', side: '#c5b59d' }) +
      box(330, 780, 940, 90, 0.04, { front: '#cdbfa8', top: '#ddd0bb', side: '#bba98f' }) +
      box(300, 790, 60, 190, 0.1, { front: '#c7b79e', top: '#dccfba', side: '#b4a286' }) +
      box(1240, 790, 60, 190, 0.1, { front: '#c7b79e', top: '#dccfba', side: '#b4a286' }) +
      `<rect x="420" y="800" width="120" height="70" rx="10" fill="#9b7b55"/><rect x="1060" y="800" width="120" height="70" rx="10" fill="#6f7a6a"/>` +
      shadow(800, 1080, 260, 26, 0.3) +
      box(600, 1010, 400, 40, 0.08, { front: '#3a2d22', top: '#7a5f45', side: '#2a2019' }) +
      plant(1350, 770, 1.1) + pendant(800, 70, 40) };
  },
  'kitchen-modern': () => {
    const p = { ceil: ['#ecebe7', '#f6f5f2'], side: ['#d7d4ce', '#e8e6e1'], back: ['#ecebe7', '#e2e0db'], floor: ['#d6d2cb', '#aaa49a'] };
    let up = '', low = '';
    for (let i = 0; i < 6; i++) up += box(450 + i * 118, 270, 112, 170, 0.0, { front: '#2f3b36', side: '#25302b' });
    for (let i = 0; i < 6; i++) low += box(450 + i * 118, 560, 112, 200, 0.0, { front: '#2f3b36', side: '#25302b' });
    return { p, body: shell(p) + floorTiles('#6c665c', 8, 7, 0.2) + spots(4) +
      `<rect x="${BW.x0}" y="440" width="${BW.x1 - BW.x0}" height="120" fill="url(#marble)"/>
       <path d="M440,470 C560,500 640,450 760,500 S960,470 1160,520" stroke="#c9c1b4" stroke-width="2" fill="none"/>` +
      up + low + `<rect x="${BW.x0}" y="552" width="${BW.x1 - BW.x0}" height="12" fill="#f4f1ec"/>` +
      `<rect x="${BW.x0}" y="435" width="${BW.x1 - BW.x0}" height="5" fill="#ffd9a0" filter="url(#glow)"/>` +
      shadow(800, 1060, 470, 40) +
      box(360, 820, 880, 220, 0.12, { front: '#2f3b36', top: '#f1eee9', side: '#26302c' }) +
      `<rect x="360" y="812" width="880" height="16" fill="#f6f3ee"/>` +
      [520, 700, 900, 1080].map((x) => `<rect x="${x - 4}" y="900" width="8" height="200" fill="#1c1c1c"/><ellipse cx="${x}" cy="900" rx="44" ry="12" fill="#B8925A"/>`).join('') +
      pendant(620, 120, 28) + pendant(800, 120, 28) + pendant(980, 120, 28) };
  },
  'bathroom-marble': () => {
    const p = { ceil: ['#f0eeea', '#f7f6f3'], side: ['#e6e2db', '#f1eee9'], back: ['#f3f0eb', '#e7e3dc'], floor: ['#dcd7cf', '#b5ada1'] };
    let veins = '';
    for (let i = 0; i < 7; i++) veins += `<path d="M${430 + i * 120},230 C${470 + i * 120},380 ${400 + i * 120},520 ${460 + i * 120},760" stroke="#cfc6b8" stroke-width="2" fill="none" opacity="0.8"/>`;
    return { p, body: shell(p) + floorTiles('#7d756a', 5, 5, 0.22) + `<rect x="${BW.x0}" y="${BW.y0}" width="${BW.x1 - BW.x0}" height="${BW.y1 - BW.y0}" fill="url(#marble)"/>` + veins + spots(3) +
      `<circle cx="800" cy="420" r="120" fill="#c9d3d6" stroke="#B8925A" stroke-width="10"/><circle cx="800" cy="420" r="150" fill="url(#light)" opacity="0.5"/>` +
      shadow(800, 760, 320, 30, 0.25) +
      box(560, 600, 480, 130, 0.0, { front: '#5b4636', side: '#47372a' }) +
      `<rect x="560" y="592" width="480" height="16" fill="#f7f4ef"/><rect x="760" y="560" width="80" height="34" rx="16" fill="#fff"/><rect x="795" y="530" width="10" height="34" fill="#B8925A"/>` +
      `<polygon points="${pts([{ x: 1180, y: 230 }, toVP({ x: 1600, y: 0 }, 0.0), { x: 1600, y: 1100 }, { x: 1180, y: 760 }])}" fill="#d9e4e8" opacity="0.18"/>` +
      `<line x1="1380" y1="120" x2="1380" y2="930" stroke="#B8925A" stroke-width="5"/>` +
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" opacity="0.04"/>` +
      plant(330, 830, 0.8) };
  },
  'bedroom-calm': () => {
    const p = { ceil: ['#ece7e0', '#f5f1ea'], side: ['#d4cbc0', '#e7e0d6'], back: ['#c9bba9', '#b9a993'], floor: ['#c8b79f', '#9d8466'] };
    let hb = '';
    for (let i = 0; i < 8; i++) hb += `<rect x="${520 + i * 70}" y="420" width="62" height="270" rx="28" fill="#e6ddcf"/>`;
    return { p, body: shell(p) + woodFloor('#5a4430') + coveCeiling('#ffcf8a') + windowLeft() + hb +
      shadow(800, 1060, 520, 46) +
      box(450, 820, 700, 230, 0.16, { front: '#efe9df', top: '#f8f5ef', side: '#ddd4c6' }) +
      `<rect x="450" y="760" width="700" height="80" rx="20" fill="#f6f2ea"/><rect x="510" y="720" width="180" height="70" rx="22" fill="#fbf9f4"/><rect x="910" y="720" width="180" height="70" rx="22" fill="#fbf9f4"/>` +
      `<rect x="450" y="900" width="700" height="150" fill="#8c6f52" opacity="0.85"/>` +
      box(330, 760, 110, 110, 0.06, { front: '#5e4734', top: '#6e5640', side: '#4a3828' }) +
      box(1160, 760, 110, 110, 0.06, { front: '#5e4734', top: '#6e5640', side: '#4a3828' }) +
      `<rect x="370" y="690" width="30" height="70" fill="#B8925A"/><ellipse cx="385" cy="690" rx="44" ry="26" fill="#f4e6cc"/><ellipse cx="385" cy="690" rx="90" ry="60" fill="url(#light)"/>` +
      `<rect x="1200" y="690" width="30" height="70" fill="#B8925A"/><ellipse cx="1215" cy="690" rx="44" ry="26" fill="#f4e6cc"/><ellipse cx="1215" cy="690" rx="90" ry="60" fill="url(#light)"/>` +
      art(700, 290, 200, 110, ['#d9cbb6', '#B8925A', '#6f6458']) };
  },
  'majlis-gypsum': () => {
    const p = { ceil: ['#efe9df', '#f6f2ea'], side: ['#e2d8ca', '#efe8dd'], back: ['#e8dfd2', '#dbcfbe'], floor: ['#e0d6c7', '#b3a28a'] };
    return { p, body: shell(p) + floorTiles('#7d6b52', 6, 6, 0.18) + coveCeiling() + spots(5) +
      `<rect x="560" y="300" width="480" height="300" fill="none" stroke="#B8925A" stroke-width="4"/><rect x="590" y="330" width="420" height="240" fill="none" stroke="#c9b48f" stroke-width="2"/>` +
      `<path d="M800,330 L870,450 L800,570 L730,450 Z" fill="none" stroke="#B8925A" stroke-width="2"/>` +
      shadow(800, 790, 380, 26, 0.25) +
      box(430, 660, 740, 100, 0.0, { front: '#7a2f2f', side: '#5e2424' }) +
      `<rect x="430" y="610" width="740" height="60" fill="#8c3a3a"/>` +
      box(60, 820, 300, 200, 0.28, { front: '#7a2f2f', top: '#8c3a3a', side: '#5e2424' }) +
      box(1240, 820, 300, 200, 0.28, { front: '#7a2f2f', top: '#8c3a3a', side: '#5e2424' }) +
      `<polygon points="420,1100 1180,1100 1060,860 540,860" fill="#c9a76f" opacity="0.55"/><polygon points="470,1080 1130,1080 1030,880 570,880" fill="none" stroke="#7a2f2f" stroke-width="4" opacity="0.6"/>` +
      shadow(800, 990, 200, 22, 0.3) + box(680, 930, 240, 50, 0.06, { front: '#3a2d22', top: '#B8925A', side: '#2a2019' }) };
  },
  'office-wood': () => {
    const p = { ceil: ['#e9e7e3', '#f3f2ef'], side: ['#cfd2cf', '#e2e4e1'], back: ['#37403d', '#2b3331'], floor: ['#c7b59b', '#957b5d'] };
    let shelves = '';
    for (let r = 0; r < 4; r++) {
      shelves += `<rect x="470" y="${300 + r * 110}" width="660" height="10" fill="#9a7a56"/>`;
      for (let b = 0; b < 9; b++) shelves += `<rect x="${490 + b * 70 + (r % 2) * 20}" y="${240 + r * 110}" width="${16 + (b % 3) * 6}" height="60" fill="${['#B8925A', '#e8e1d5', '#6f7a6a', '#8c3a3a'][(b + r) % 4]}" opacity="0.9"/>`;
    }
    return { p, body: shell(p) + woodFloor('#4f3b28') + spots(4) + windowLeft() + shelves +
      shadow(800, 1030, 430, 40) +
      box(420, 850, 760, 40, 0.12, { front: '#6b4f36', top: '#8c6a4a', side: '#56402c' }) +
      `<rect x="450" y="890" width="40" height="190" fill="#1f1f1f"/><rect x="1110" y="890" width="40" height="190" fill="#1f1f1f"/>` +
      `<rect x="680" y="700" width="240" height="140" fill="#141517"/><rect x="785" y="840" width="30" height="20" fill="#2a2a2a"/>` +
      `<path d="M700,980 Q800,900 900,980 L890,1100 L710,1100 Z" fill="#26292d"/>` + plant(1330, 820, 1) };
  },
};

// نسخة «قبل»: نفس المساحة على المحارة مع خطوط قياس هندسية
function before(name) {
  const p = { ceil: ['#b9b6b0', '#c7c4be'], side: ['#a8a59f', '#bab7b1'], back: ['#b4b1ab', '#a29f99'], floor: ['#8f8c86', '#76736e'] };
  const dim = '#3b4a5a';
  return { p, body: shell(p) +
    `<g opacity="0.55">` + [...Array(40)].map((_, i) => `<circle cx="${(i * 397) % W}" cy="${(i * 211) % H}" r="${2 + (i % 4)}" fill="#6d6a65"/>`).join('') + `</g>` +
    `<path d="M${BW.x0 + 60},${BW.y0} L${BW.x0 + 60},${BW.y0 + 180} L${BW.x0 + 260},${BW.y0 + 180}" stroke="#d4462c" stroke-width="5" fill="none"/>` +
    `<path d="M${BW.x1 - 120},${BW.y0} L${BW.x1 - 120},${BW.y1 - 160}" stroke="#2b5f9e" stroke-width="5" fill="none"/>` +
    `<rect x="${BW.x1 - 150}" y="${BW.y1 - 170}" width="60" height="70" fill="#d9d6d0" stroke="#555" stroke-width="2"/>` +
    // سلم وجردل
    `<g stroke="#5a4a3a" stroke-width="10"><line x1="1180" y1="1060" x2="1290" y2="640"/><line x1="1290" y1="1060" x2="1380" y2="640"/></g>` +
    [0, 1, 2, 3, 4].map((i) => `<line x1="${1195 + i * 22}" y1="${1000 - i * 84}" x2="${1300 + i * 20}" y2="${1000 - i * 84}" stroke="#5a4a3a" stroke-width="8"/>`).join('') +
    `<path d="M380,960 L470,960 L460,1060 L390,1060 Z" fill="#e6e1d8" stroke="#555" stroke-width="3"/>` +
    `<g stroke="${dim}" stroke-width="2" fill="none" opacity="0.85">
      <line x1="${BW.x0}" y1="${BW.y0 - 40}" x2="${BW.x1}" y2="${BW.y0 - 40}"/><line x1="${BW.x0}" y1="${BW.y0 - 55}" x2="${BW.x0}" y2="${BW.y0 - 25}"/><line x1="${BW.x1}" y1="${BW.y0 - 55}" x2="${BW.x1}" y2="${BW.y0 - 25}"/>
      <line x1="${BW.x1 + 40}" y1="${BW.y0}" x2="${BW.x1 + 40}" y2="${BW.y1}"/>
      <polyline points="${BW.x0},${BW.y0} ${BW.x0},${BW.y1} ${BW.x1},${BW.y1} ${BW.x1},${BW.y0} ${BW.x0},${BW.y0}" stroke-dasharray="10 8"/></g>` };
}

async function render(file, scene, w = 1600) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(scene.p)}${scene.body}<rect width="${W}" height="${H}" fill="url(#vignette)"/></svg>`;
  for (const [suffix, width] of [['', w], ['-sm', 800]]) {
    await sharp(Buffer.from(svg)).resize({ width }).webp({ quality: 82 }).toFile(path.join(OUT, `${file}${suffix}.webp`));
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, fn] of Object.entries(scenes)) {
    await render(name, fn());
  }
  await render('raw-shell-before', before());
  console.log('Demo images generated in', OUT);
})();
