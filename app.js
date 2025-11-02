const video = document.getElementById('camera');
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
const btnCamera = document.getElementById('btnCamera');
const btnGyro = document.getElementById('btnGyro');
const toggleLines = document.getElementById('toggleLines');
const toggleAnimals = document.getElementById('toggleAnimals');

// Resize canvas to full screen
function fit() {
  const { innerWidth:w, innerHeight:h, devicePixelRatio:dpr=1 } = window;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fit);
fit();

// Start camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(()=>{});
  } catch (err) {
    console.error('No se pudo abrir la cámara', err);
    btnCamera.textContent = 'Cámara bloqueada';
  }
}

btnCamera.addEventListener('click', startCamera);

// Orientation / gyro support
let yaw = 0, pitch = 0, roll = 0;
let haveGyro = false;

function handleOrientation(ev){
  // alpha: z (0..360), beta: x (-180..180), gamma: y (-90..90)
  if (typeof ev.alpha === 'number') {
    yaw = (ev.alpha || 0) * Math.PI/180;
    pitch = (ev.beta || 0) * Math.PI/180;
    roll = (ev.gamma || 0) * Math.PI/180;
    haveGyro = true;
  }
}

async function enableGyro(){
  try {
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') throw new Error('Permiso denegado');
    }
    window.addEventListener('deviceorientation', handleOrientation, true);
    btnGyro.textContent = 'Brújula activa';
  } catch (e) {
    console.warn('Giroscopio no disponible', e);
    btnGyro.textContent = 'Sin brújula';
  }
}
btnGyro.addEventListener('click', enableGyro);

// Star field generation (aesthetic, not astronomical precision)
const rng = mulberry32(Date.now() >>> 0);
const STARS = createStars(320);
const CONSTELLATIONS = buildConstellations(STARS);

// Animal constellations (vector line art normalized to 0..1)
const ANIMAL_SHAPES = createAnimalShapes();
const ANIMALS = placeAnimals(ANIMAL_SHAPES);

function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function createStars(n){
  const stars = [];
  // Create a virtual sky larger than viewport for parallax
  for (let i=0;i<n;i++){
    const layer = i%3; // 0 near, 1 mid, 2 far
    stars.push({
      x: rng()*2 - 0.5, // -0.5..1.5 (wider than screen)
      y: rng()*2 - 0.5, // -0.5..1.5
      size: 0.6 + Math.pow(rng(), 3) * 2.2,
      layer,
      hue: 200 + rng()*40, // bluish stars
      tw: rng()*Math.PI*2,
    });
  }
  return stars;
}

function buildConstellations(stars){
  // Pick a few groups of nearby stars to connect aesthetically
  const groups = [];
  const pickFrom = stars.filter((_,i)=> i%4===0);
  for (let g=0; g<7; g++){
    const start = Math.floor(rng()*pickFrom.length);
    const chain = [ pickFrom[start] ];
    for (let k=0;k<5;k++){
      // find a close star
      let best=null, bd=1e9;
      for (let j=0;j<stars.length;j++){
        const s = stars[j];
        const dx = s.x - chain[chain.length-1].x;
        const dy = s.y - chain[chain.length-1].y;
        const d2 = dx*dx + dy*dy;
        if (d2>0.0005 && d2<bd && d2<0.05) { best=s; bd=d2; }
      }
      if (best) chain.push(best);
    }
    groups.push({ name: fancyName(), stars: chain });
  }
  return groups;
}

function fancyName(){
  const a=['Orión','Andrómeda','Cisne','Fénix','Lyra','Delfín','Pegaso','Canopus','Corona','Apus'];
  return a[Math.floor(rng()*a.length)];
}

// Render loop
let t0 = performance.now();
function draw(){
  const now = performance.now();
  const dt = Math.min(0.033, (now - t0)/1000); // seconds
  t0 = now;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  // slight drift if no gyro
  if (!haveGyro){
    yaw += 0.02 * dt; // slow pan
    pitch = Math.sin(now*0.0002) * 0.1;
  }

  ctx.clearRect(0,0,W,H);

  // Parallax from orientation
  const panX = Math.sin(yaw) * 0.2;
  const panY = Math.sin(pitch) * 0.2;

  // Draw stars
  for (const s of STARS){
    const x = (s.x + panX * (0.2 + s.layer*0.2)) * W;
    const y = (s.y + panY * (0.2 + s.layer*0.2)) * H;
    const tw = (Math.sin(s.tw + now*0.003 + s.size) + 1) * 0.5; // 0..1
    const r = Math.max(0.6, s.size + tw*0.6);
    ctx.beginPath();
    ctx.fillStyle = `hsl(${s.hue + tw*20} 90% ${80 + tw*10}%)`;
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }

  // Draw constellation lines & labels
  if (toggleLines.checked){
    ctx.strokeStyle = 'rgba(255, 215, 130, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#f2a900';
    ctx.shadowBlur = 8;
    for (const g of CONSTELLATIONS){
      ctx.beginPath();
      for (let i=0;i<g.stars.length;i++){
        const s = g.stars[i];
        const x = (s.x + panX*0.35) * W;
        const y = (s.y + panY*0.35) * H;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();

      // Label near middle
      const mid = g.stars[Math.floor(g.stars.length/2)];
      const lx = (mid.x + panX*0.35) * W;
      const ly = (mid.y + panY*0.35) * H - 8;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 12px Montserrat, sans-serif';
      ctx.fillText(g.name, lx+6, ly);
      ctx.restore();
    }
  }

  // Draw animated animal constellations
  if (toggleAnimals && toggleAnimals.checked){
    renderAnimals(ctx, W, H, panX, panY, now);
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// Auto-start camera if possible
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
  startCamera();
}

// Helpful tips in console
console.log('%cTip','background:#f2a900;color:#1a0b00;padding:2px 6px;border-radius:6px','Para iOS, toca "Activar brújula" para habilitar orientación.');

// ---- Animal constellation helpers ----
function createAnimalShapes(){
  // Points are arrays of [x,y] in unit space. Multiple strokes per shape.
  // Hummingbird (Colibrí): body, beak, wings, tail (simple stylized)
  const hummingbird = {
    name: 'Colibrí',
    strokes: [
      // body curve
      [[0.45,0.55],[0.50,0.50],[0.55,0.47],[0.60,0.48],[0.62,0.52],[0.60,0.56],[0.54,0.58],[0.49,0.57]],
      // head + beak
      [[0.62,0.52],[0.66,0.50],[0.78,0.47]],
      // top wing
      [[0.52,0.50],[0.46,0.40],[0.40,0.33],[0.35,0.31],[0.33,0.34],[0.38,0.40],[0.45,0.47]],
      // bottom wing
      [[0.48,0.58],[0.42,0.67],[0.38,0.73],[0.36,0.77],[0.40,0.78],[0.46,0.72],[0.50,0.64]],
      // tail
      [[0.47,0.60],[0.44,0.66],[0.41,0.72],[0.40,0.76]],
    ],
    nodes: [[0.62,0.52],[0.50,0.50],[0.46,0.40],[0.40,0.73]]
  };

  // Fox (Zorro) profile
  const fox = {
    name: 'Zorro',
    strokes: [
      // nose to ear
      [[0.20,0.60],[0.32,0.58],[0.40,0.54],[0.48,0.48],[0.54,0.40],[0.57,0.32]],
      // ear top to back
      [[0.57,0.32],[0.60,0.40],[0.64,0.46],[0.70,0.52]],
      // back to tail
      [[0.70,0.52],[0.76,0.58],[0.80,0.64],[0.82,0.72]],
      // tail flourish
      [[0.82,0.72],[0.76,0.74],[0.70,0.72],[0.64,0.70],[0.58,0.72],[0.52,0.76]],
      // underside back to nose
      [[0.52,0.76],[0.46,0.72],[0.40,0.66],[0.34,0.62],[0.26,0.60],[0.20,0.60]],
    ],
    nodes: [[0.57,0.32],[0.70,0.52],[0.82,0.72]]
  };

  // Dolphin (Delfín)
  const dolphin = {
    name: 'Delfín',
    strokes: [
      [[0.20,0.55],[0.30,0.48],[0.42,0.44],[0.55,0.43],[0.66,0.46],[0.76,0.50],[0.84,0.56]],
      [[0.42,0.44],[0.36,0.36],[0.32,0.34]],
      [[0.55,0.43],[0.52,0.48],[0.50,0.52]],
      [[0.76,0.50],[0.82,0.48],[0.88,0.46]],
    ],
    nodes: [[0.30,0.48],[0.55,0.43],[0.76,0.50]]
  };

  return [hummingbird, fox, dolphin];
}

function placeAnimals(shapes){
  // Place a few instances across the sky with random rotation/scale
  const arr = [];
  const areas = [
    {x:0.25,y:0.30},{x:0.70,y:0.28},{x:0.50,y:0.18},
    {x:0.20,y:0.62},{x:0.78,y:0.60}
  ];
  let i = 0;
  for (const pos of areas){
    const shape = shapes[i % shapes.length]; i++;
    arr.push({
      shape,
      x: pos.x + (rng()*0.05 - 0.025),
      y: pos.y + (rng()*0.05 - 0.025),
      scale: 0.8 + rng()*0.6,
      rot: (rng()*2-1) * 0.25,
      phase: rng()*Math.PI*2,
    });
  }
  return arr;
}

function renderAnimals(ctx, W, H, panX, panY, now){
  const t = now * 0.0015; // speed
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of ANIMALS){
    const px = (a.x + panX*0.25) * W;
    const py = (a.y + panY*0.25) * H;
    const sc = (Math.sin(t*0.6 + a.phase)*0.02 + 1) * a.scale * Math.min(W,H) * 0.35;
    const rot = a.rot + Math.sin(t*0.3 + a.phase)*0.02;
    const progress = (Math.sin(t + a.phase) + 1) * 0.5; // 0..1

    // draw glow underlay
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(sc, sc);

    drawShapeProgress(ctx, a.shape, progress, {
      color: 'rgba(242,169,0,0.9)',
      width: 0.010,
      glow: 16
    });

    // star nodes
    for (const n of a.shape.nodes){
      const tw = (Math.sin(now*0.004 + (n[0]+n[1])*40) + 1)*0.5;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 240, 200, ${0.7 + tw*0.3})`;
      const r = 0.012 + tw*0.010;
      ctx.arc(n[0]-0.5, n[1]-0.5, r, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }
  ctx.restore();
}

function drawShapeProgress(ctx, shape, progress, opts){
  const color = opts.color || 'white';
  const width = (opts.width || 0.008) * Math.max(1, 1);
  const glow = opts.glow || 8;

  // total length of all strokes
  const len = totalLength(shape.strokes);
  const drawLen = len * (0.2 + progress*0.8); // never fully zero for visibility

  // shadow pass
  ctx.shadowColor = color; ctx.shadowBlur = glow;
  ctx.strokeStyle = color; ctx.lineWidth = width*1.1;
  traceStrokes(ctx, shape.strokes, drawLen);

  // core pass
  ctx.shadowBlur = 0; ctx.globalAlpha = 0.95;
  ctx.strokeStyle = 'rgba(255,230,180,1)'; ctx.lineWidth = width*0.9;
  traceStrokes(ctx, shape.strokes, drawLen);
  ctx.globalAlpha = 1;
}

function totalLength(strokes){
  let L=0; for (const s of strokes){ for(let i=1;i<s.length;i++){ const a=s[i-1],b=s[i]; L+=dist(a,b);} } return L;
}
function dist(a,b){ const dx=(b[0]-a[0]), dy=(b[1]-a[1]); return Math.hypot(dx,dy); }

function traceStrokes(ctx, strokes, drawLen){
  let left = drawLen;
  for (const s of strokes){
    if (left <= 0) break;
    ctx.beginPath();
    // Normalize to center origin (-0.5..0.5)
    let moved=false;
    for (let i=1;i<s.length;i++){
      const a = s[i-1], b = s[i];
      const seg = dist(a,b);
      if (!moved){ ctx.moveTo(a[0]-0.5, a[1]-0.5); moved=true; }
      if (left >= seg){
        ctx.lineTo(b[0]-0.5, b[1]-0.5);
        left -= seg;
      } else {
        const t = Math.max(0, left/seg);
        const x = a[0] + (b[0]-a[0])*t;
        const y = a[1] + (b[1]-a[1])*t;
        ctx.lineTo(x-0.5, y-0.5);
        left = 0;
        break;
      }
    }
    ctx.stroke();
  }
}
