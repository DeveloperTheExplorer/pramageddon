const PALETTE = {
  k: '#281f3d',
  w: '#fffaf0',
  c: '#fff1cf',
  p: '#ff9ec7',
  P: '#df6d9c',
  y: '#ffd166',
  Y: '#e9a92e',
  o: '#f29b52',
  b: '#8ecae6',
  B: '#3b8ea5',
  t: '#c98b5b',
  T: '#8d5a3b',
  g: '#7ee0c3',
  r: '#ef5b6b',
  m: '#b8f2e6',
  l: '#b3a4ff',
  s: '#8f9bb3',
};

// Every map is exactly 16x16 so the pixels stay square in every size.
const MAPS = {
  pacifier: [
    '................',
    '................',
    '......kkkk......',
    '.....kppppk.....',
    '....kppkkppk....',
    '....kpk..kpk....',
    '....kpk..kpk....',
    '....kppkkppk....',
    '.....kppppk.....',
    '......kkkk......',
    '.....kkkkkk.....',
    '....kyyyyyyk....',
    '...kyyYYYYyyk...',
    '....kyyyyyyk....',
    '.....kkkkkk.....',
    '................',
  ],
  bottle: [
    '.....kkk........',
    '....kwwwk.......',
    '....kwwwk.......',
    '.....kkk........',
    '....kkkkkk......',
    '...kwccccwk.....',
    '...kwccccwk.....',
    '...kwyyyywk.....',
    '...kwyyyywk.....',
    '...kwyyyywk.....',
    '...kwyyyywk.....',
    '...kwyyyywk.....',
    '...kwyyyywk.....',
    '...kkkkkkkk.....',
    '................',
    '................',
  ],
  blanket: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kbbbbbbbbk...',
    '...kbwwbbwwbk...',
    '...kbbbbbbbbk...',
    '...kbwwwwwwbk...',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '...kbwwbbwwbk...',
    '...kbbbbbbbbk...',
    '...kbbbbbbbbk...',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
  ],
  teddy: [
    '................',
    '...kk....kk.....',
    '..kttk..kttk....',
    '..kttkkkkttk....',
    '...kttttttk.....',
    '..kttttttttk....',
    '.kttkttttkttk...',
    '.kttttttttttk...',
    '.kttttttttttk...',
    '.kttttttttttk...',
    '..kttttttttk....',
    '...kttttttk.....',
    '...kttkttkk.....',
    '..kttkkkkttk....',
    '..kkk....kkk....',
    '................',
  ],
  cry: [
    '...kkkkkkkkkk...',
    '..kcccccccccck..',
    '.kcccccccccccck.',
    '.kcckkcccckkcck.',
    '.kcckkcccckkcck.',
    '.kcccccccccccck.',
    '.kccckkkkkkccck.',
    '.kcckrrrrrrkcck.',
    '.kcckrrrrrrkcck.',
    '.kcccckkkkcccck.',
    '.kcccccccccccck.',
    '.kcccccccccccck.',
    '..kcccccccccck..',
    '...kkkkkkkkkk...',
    '....b.....b.....',
    '...b.......b....',
  ],
  zzz: [
    '................',
    '....kkkkkk......',
    '...kwwwwwwk.....',
    '...kwwwwwwk.....',
    '......kkk.......',
    '.....kkk........',
    '....kkk.........',
    '...kkkkkk.......',
    '..kwwwwwwk......',
    '..kwwwwwwk......',
    '......kkk.......',
    '.....kkk........',
    '....kkk.........',
    '...kkkkkkkk.....',
    '..kwwwwwwwwk....',
    '................',
  ],
  heart: [
    '................',
    '...kkk..kkk.....',
    '..krrrkkrrrk....',
    '.krrrrrrrrrrk...',
    '.krrrrrrrrrrk...',
    '.krrrrrrrrrrk...',
    '..krrrrrrrrk....',
    '...krrrrrrk.....',
    '....krrrrk......',
    '.....krrk.......',
    '......kk........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  star: [
    '.......kk.......',
    '......kyyk......',
    '......kyyk......',
    '.kkkkkkyykkkkkk.',
    '.kyyyyyyyyyyyyk.',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '....kyyyyyyk....',
    '....kyyyyyyk....',
    '...kyykkkkyyk...',
    '..kyyk....kyyk..',
    '.kyyk......kyyk.',
    '.kk..........kk.',
    '................',
    '................',
    '................',
  ],
  warning: [
    '................',
    '.......kk.......',
    '......kyyk......',
    '......kyyk......',
    '.....kyyyyk.....',
    '.....kyyyyk.....',
    '....kyyyyyyk....',
    '....kyykyyyk....',
    '...kyyykyyyyk...',
    '...kyyykyyyyk...',
    '..kyyyyyyyyyyk..',
    '..kyyyykyyyyyk..',
    '.kyyyyyyyyyyyyk.',
    '.kyyyyyyyyyyyyk.',
    '.kkkkkkkkkkkkkk.',
    '................',
  ],
};

function validateMaps() {
  for (const [name, rows] of Object.entries(MAPS)) {
    if (rows.length !== 16) throw new Error(`Icon ${name} has ${rows.length} rows`);
    rows.forEach((row, i) => {
      if (row.length !== 16) throw new Error(`Icon ${name} row ${i} has ${row.length} cols`);
    });
  }
}
validateMaps();

const cache = new Map();

export function getIconCanvas(name) {
  if (cache.has(name)) return cache.get(name);
  const rows = MAPS[name] || MAPS.warning;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = PALETTE[ch] || '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(name, canvas);
  return canvas;
}

export function getIconDataUrl(name) {
  return getIconCanvas(name).toDataURL('image/png');
}

export function iconImg(name, className = 'pixel-icon') {
  return `<img class="${className}" src="${getIconDataUrl(name)}" alt="${name}" draggable="false" />`;
}
