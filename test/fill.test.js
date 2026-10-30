// node test/fill.test.js — проверка упаковки заливки (связность k-ссылок, покрытие, отсутствие пересечений)
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/03-painter.js'), 'utf8').replace(/\r\n/g, '\n');
const grab = name => src.slice(src.indexOf('function ' + name), src.indexOf('\n}\n', src.indexOf('function ' + name)) + 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), round = Math.round;
eval(grab('floodRects') + grab('orderRects'));

function makeImg(W, H, draw) {
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (draw(x, y)) { const i = (y * W + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  return { data };
}

function check(name, W, H, draw, sx, sy) {
  const img = makeImg(W, H, draw);
  const rects = floodRects(img, W, H, sx, sy, 24);
  const cover = new Uint8Array(W * H);
  let errors = 0;
  rects.forEach(([x, y, w, h, k], i) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (cover[yy * W + xx]) errors++; cover[yy * W + xx] = 1; }
    if (i === 0) { if (k !== 0 || !(sx >= x && sx < x + w && sy >= y && sy < y + h)) errors++; return; }
    if (k % 5 || k / 5 >= i) { errors++; return; }
    const [px, py, pw, ph] = rects[k / 5];
    const vert = (py + ph === y || y + h === py) && px < x + w && x < px + pw;
    if (!vert) errors++;
  });
  console.log(`${errors ? 'FAIL' : 'ok  '} ${name}: ${rects.length} прямоугольников, ошибок ${errors}`);
  return errors;
}

let bad = 0;
bad += check('пустой холст', 200, 120, () => false, 10, 10);
bad += check('рамка', 200, 120, (x, y) => (x >= 50 && x <= 150 && (y === 30 || y === 90)) || (y >= 30 && y <= 90 && (x === 50 || x === 150)), 100, 60);
bad += check('снаружи рамки', 200, 120, (x, y) => (x >= 50 && x <= 150 && (y === 30 || y === 90)) || (y >= 30 && y <= 90 && (x === 50 || x === 150)), 5, 5);
bad += check('диагональ и круг', 300, 200, (x, y) => Math.abs(x - y) < 3 || Math.abs(Math.hypot(x - 200, y - 100) - 50) < 2, 250, 30);
bad += check('шум', 160, 100, (x, y) => ((x * 7919 + y * 104729) % 13) === 0, 80, 50);
process.exit(bad ? 1 : 0);
