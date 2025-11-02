const video = document.getElementById('camera');
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
const btnCamera = document.getElementById('btnCamera');
const btnGyro = document.getElementById('btnGyro');
const btnCapture = document.getElementById('btnCapture');
const toggleLines = document.getElementById('toggleLines');
const toggleAnimals = document.getElementById('toggleAnimals');
const promptEl = document.getElementById('prompt');
const promptBtn = document.getElementById('promptBtn');
const promptMsg = document.getElementById('promptMsg');
const intro = document.getElementById('intro');
const needle = document.getElementById('needle');
const headingEl = document.getElementById('heading');

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
window.addEventListener('load', fit);

// Start camera
let cameraReady = false;
let lastCamError = '';
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(()=>{});
    cameraReady = true;
    hidePrompt();
  } catch (err) {
    console.error('No se pudo abrir la cámara', err);
    lastCamError = err && err.message || String(err);
    btnCamera.textContent = 'Cámara bloqueada';
    showPrompt(lastCamError);
  }
}

btnCamera.addEventListener('click', startCamera);
if (promptBtn) promptBtn.addEventListener('click', startCamera);
if (btnCapture) btnCapture.addEventListener('click', capturePhoto);

function showPrompt(msg){
  if (!promptEl) return;
  if (!window.isSecureContext){
    promptMsg.textContent = 'Se requiere HTTPS para usar la cámara. Abre la versión segura del sitio.';
  } else if (msg) {
    const friendly = msg.includes('Permission')||msg.includes('denied') ? 'Permiso denegado. Toca "Permitir cámara".' : msg;
    promptMsg.textContent = friendly;
  } else {
    promptMsg.textContent = 'Para vivir la experiencia, permite el acceso a la cámara.';
  }
  promptEl.classList.remove('hidden');
}
function hidePrompt(){ if (promptEl) promptEl.classList.add('hidden'); }

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
    const deg = Math.round(ev.alpha || 0);
    if (needle) needle.style.transform = `translate(-50%,-90%) rotate(${deg}deg)`;
    if (headingEl) headingEl.textContent = `${deg}°`;
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
const STARS = createStars(600);
const CONSTELLATIONS = buildConstellations(STARS);

// Animal constellations (vector line art normalized to 0..1)
const ANIMAL_SHAPES = createAnimalShapes();
let ANIMALS = placeAnimals(ANIMAL_SHAPES);
// Estados para mostrar 1 animal y 1 constelación a la vez
let currentAnimalIndex = 0;
let currentAnimal = buildAnimalInstance(ANIMAL_SHAPES[currentAnimalIndex]);
const CYCLE = { animalDuration: 7000, constellationDuration: 6000 };
let nextAnimalAt = performance.now() + CYCLE.animalDuration;
let currentConstellationIndex = 0;
let nextConstAt = performance.now() + CYCLE.constellationDuration;

// Extra animations: shooting stars, particles and aurora
const METEORS = [];
const PARTICLES = [];

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

  // Aurora backdrop
  renderAurora(ctx, W, H, now, panX, panY);

  // Draw stars (ligeramente rotado por brújula para dar dirección)
  const rot = haveGyro ? Math.sin(yaw)*0.02 : 0;
  if (rot){ ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(rot); ctx.translate(-W/2,-H/2); }
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
  if (rot){ ctx.restore(); }

  // Draw ONE constellation at a time (ciclo)
  if (toggleLines.checked){
    const nowS = now;
    if (nowS > nextConstAt){
      currentConstellationIndex = (currentConstellationIndex + 1) % CONSTELLATIONS.length;
      nextConstAt = nowS + CYCLE.constellationDuration;
    }
    const g = CONSTELLATIONS[currentConstellationIndex];
    const prog = 0.2 + 0.8*((CYCLE.constellationDuration - (nextConstAt - nowS))/CYCLE.constellationDuration);
    const segs = Math.max(2, Math.floor(prog * g.stars.length));

    ctx.strokeStyle = 'rgba(255, 215, 130, 0.85)';
    ctx.lineWidth = 1.7;
    ctx.shadowColor = '#f2a900';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i=0;i<segs;i++){
      const s = g.stars[i];
      const x = (s.x + panX*0.35) * W;
      const y = (s.y + panY*0.35) * H;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    const mid = g.stars[Math.min(g.stars.length-1, Math.floor(segs/2))];
    const lx = (mid.x + panX*0.35) * W;
    const ly = (mid.y + panY*0.35) * H - 8;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 12px Montserrat, sans-serif';
    ctx.fillText(g.name, lx+6, ly);
    ctx.restore();
  }

  // Draw ONE animal at a time
  if (toggleAnimals && toggleAnimals.checked){
    if (now > nextAnimalAt){
      currentAnimalIndex = (currentAnimalIndex + 1) % ANIMAL_SHAPES.length;
      currentAnimal = buildAnimalInstance(ANIMAL_SHAPES[currentAnimalIndex]);
      nextAnimalAt = now + CYCLE.animalDuration;
    }
    renderAnimals(ctx, W, H, panX, panY, now, [currentAnimal]);
  }

  // Shooting stars, comets and particle overlays
  updateMeteors(ctx, W, H, now, panX, panY);
  updateComets(ctx, W, H, now);
  updateParticles(ctx, W, H, now);

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// Auto-start camera if possible
// En iOS Safari, getUserMedia requiere gesto de usuario. Mostramos prompt si no está lista.
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
  // intenta arrancar; si falla por falta de gesto, se mostrará el prompt con botón
  startCamera();
} else {
  showPrompt('Este navegador no soporta cámara.');
}

// Helpful tips in console
console.log('%cTip','background:#f2a900;color:#1a0b00;padding:2px 6px;border-radius:6px','Para iOS, toca "Activar brújula" para habilitar orientación.');

// Intro fade out
window.addEventListener('load', ()=>{ setTimeout(()=>{ if (intro) intro.classList.add('fade'); }, 1200); });

// ---- Capture photo (composite video + overlays) ----
async function capturePhoto(){
  try{
    const w = canvas.width;   // device pixels
    const h = canvas.height;
    if (!w || !h){ return; }
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    // Draw camera frame
    if (video && video.videoWidth){
      octx.drawImage(video, 0, 0, w, h);
    }
    // Draw star/constellation canvas
    octx.drawImage(canvas, 0, 0);
    // Soft vignette like on screen
    const rg = octx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.45, w/2, h/2, Math.min(w,h)*0.55);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.35)');
    octx.fillStyle = rg; octx.fillRect(0,0,w,h);
    // Timestamp watermark
    const ts = new Date();
    const pad = n=> String(n).padStart(2,'0');
    const label = `${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
    octx.font = `${Math.round(Math.max(w,h)*0.02)}px Montserrat, sans-serif`;
    octx.fillStyle = 'rgba(255,255,255,0.9)';
    octx.textBaseline = 'bottom';
    octx.fillText(label, 20, h-20);

    off.toBlob((blob)=>{
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts2 = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      a.href = url; a.download = `noche-estrellas-${ts2}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }catch(e){
    console.warn('No se pudo capturar la foto', e);
  }
}

// ---- Animal constellation helpers ----
function createAnimalShapes(){
  // Points are arrays of [x,y] in unit space. Multiple strokes per shape.
  // Hummingbird (Colibrí): body, beak, wings, tail (simple stylized)
  const hummingbird = {
    name: 'Colibri',
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
    name: 'Delfin',
    strokes: [
      [[0.20,0.55],[0.30,0.48],[0.42,0.44],[0.55,0.43],[0.66,0.46],[0.76,0.50],[0.84,0.56]],
      [[0.42,0.44],[0.36,0.36],[0.32,0.34]],
      [[0.55,0.43],[0.52,0.48],[0.50,0.52]],
      [[0.76,0.50],[0.82,0.48],[0.88,0.46]],
    ],
    nodes: [[0.30,0.48],[0.55,0.43],[0.76,0.50]]
  };

  // Butterfly (Mariposa) – symmetric wings
  const butterfly = {
    name: 'Mariposa',
    strokes: [
      // body
      [[0.50,0.35],[0.50,0.50],[0.50,0.65]],
      // left wing top
      [[0.50,0.45],[0.42,0.38],[0.34,0.36],[0.30,0.41],[0.34,0.47],[0.42,0.50]],
      // left wing bottom
      [[0.50,0.55],[0.42,0.58],[0.34,0.63],[0.32,0.70],[0.38,0.73],[0.45,0.66]],
      // right wing top
      [[0.50,0.45],[0.58,0.38],[0.66,0.36],[0.70,0.41],[0.66,0.47],[0.58,0.50]],
      // right wing bottom
      [[0.50,0.55],[0.58,0.58],[0.66,0.63],[0.68,0.70],[0.62,0.73],[0.55,0.66]],
    ],
    nodes: [[0.50,0.50],[0.42,0.38],[0.58,0.38],[0.34,0.63],[0.66,0.63]]
  };

  // Elephant (Elefante)
  const elephant = {
    name: 'Elefante',
    strokes: [
      [[0.25,0.60],[0.40,0.55],[0.55,0.55],[0.64,0.60]],
      [[0.48,0.54],[0.46,0.50],[0.44,0.52],[0.46,0.58],[0.48,0.54]],
      [[0.64,0.60],[0.70,0.62],[0.72,0.66],[0.68,0.70]],
      [[0.36,0.60],[0.36,0.68]],
      [[0.54,0.60],[0.54,0.70]],
    ],
    nodes: [[0.46,0.50],[0.36,0.68],[0.54,0.70]]
  };

  // Lion (Leon)
  const lion = {
    name: 'Leon',
    strokes: [
      [[0.45,0.52],[0.46,0.46],[0.50,0.44],[0.54,0.46],[0.56,0.52],[0.54,0.58],[0.50,0.60],[0.46,0.58],[0.45,0.52]],
      [[0.50,0.52],[0.54,0.54]],
      [[0.56,0.56],[0.62,0.58],[0.68,0.60],[0.72,0.64]],
      [[0.72,0.64],[0.76,0.64],[0.78,0.60]],
    ],
    nodes: [[0.50,0.44],[0.56,0.56],[0.72,0.64]]
  };

  return [hummingbird, butterfly, elephant, lion];
}

function buildAnimalInstance(shape){
  // Construye un animal en el centro con ligeras variaciones
  return {
    shape,
    x: 0.5 + (rng()*0.02 - 0.01),
    y: 0.52 + (rng()*0.02 - 0.01),
    scale: 1.15 + rng()*0.35,
    rot: (rng()*2-1) * 0.15,
    phase: rng()*Math.PI*2,
  };
}

function placeAnimals(shapes){
  // Coloca figuras cerca del centro sin traslaparse
  const arr = [];
  const vw = Math.max(320, window.innerWidth || 800);
  const vh = Math.max(320, window.innerHeight || 600);
  const n = Math.min(shapes.length, (Math.min(vw, vh) < 520 ? 3 : 4));
  const cx = 0.5, cy = 0.5;
  const baseR = 0.14;
  const minD = 0.18; // distancia mínima entre centros en espacio 0..1
  let attempts = 0;
  while (arr.length < n && attempts < 400){
    attempts++;
    const idx = arr.length % shapes.length;
    const angle = (arr.length/n)*Math.PI*2 + (rng()*0.6 - 0.3);
    const r = baseR * (0.85 + rng()*0.4);
    const x = cx + Math.cos(angle)*r;
    const y = cy + Math.sin(angle)*r*0.8;
    if (x < 0.30 || x > 0.70 || y < 0.35 || y > 0.70) continue; // mantén en zona central
    const ok = arr.every(a => {
      const dx = a.x - x, dy = a.y - y;
      return (dx*dx + dy*dy) > (minD*minD);
    });
    if (!ok) continue;
    arr.push({
      shape: shapes[idx],
      x, y,
      scale: 1.05 + rng()*0.45,
      rot: (rng()*2-1) * 0.18,
      phase: rng()*Math.PI*2,
    });
  }
  if (arr.length === 0){
    arr.push({ shape: shapes[0], x: cx, y: cy, scale: 1.2, rot: 0, phase: rng()*Math.PI*2 });
  }
  return arr;
}

function renderAnimals(ctx, W, H, panX, panY, now, animals){
  const t = now * 0.0015; // speed
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const list = animals || ANIMALS;
  for (const a of list){
    const px = (a.x + panX*0.10) * W;
    const py = (a.y + panY*0.10) * H;
    const sc = (Math.sin(t*0.6 + a.phase)*0.02 + 1) * a.scale * Math.min(W,H) * 0.42;
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

      // Emit sparkle particles
      if (Math.random() < 0.12){
        const px = (a.x + panX*0.25 + (n[0]-0.5)*sc/W*2) * W; // approx
        const py = (a.y + panY*0.25 + (n[1]-0.5)*sc/H*2) * H;
        spawnParticle(px, py);
      }
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

// ---- Shooting stars ----
function spawnMeteor(W, H, panX, panY){
  // Spawn from the top-center region so they cross the middle of the screen
  const x = W*(0.30 + Math.random()*0.40); // 30%..70%
  const y = -20;
  const speed = 500 + Math.random()*450;
  const angle = (-45 + Math.random()*10) * Math.PI/180; // down-right
  METEORS.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 1.0+Math.random()*0.9, age:0, len: 160+Math.random()*120 });
}

let lastMeteor = 0;
function updateMeteors(ctx, W, H, now, panX, panY){
  const t = now/1000;
  if (t - lastMeteor > 1.5 + Math.random()*1.0 && METEORS.length < 5){
    lastMeteor = t;
    spawnMeteor(W,H,panX,panY);
  }
  for (let i=METEORS.length-1;i>=0;i--){
    const m = METEORS[i];
    const dt = 1/60;
    m.age += dt;
    m.x += m.vx*dt; m.y += m.vy*dt;
    // draw streak
    const alpha = Math.max(0, 1 - m.age/m.life);
    const tailX = m.x - m.vx*dt* m.len/60;
    const tailY = m.y - m.vy*dt* m.len/60;
    const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, `rgba(255,220,120,0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tailX, tailY); ctx.stroke();
    // glow
    ctx.beginPath(); ctx.fillStyle = `rgba(255,240,200,${alpha*0.8})`; ctx.arc(m.x, m.y, 2.5, 0, Math.PI*2); ctx.fill();
    if (m.age > m.life || m.x>W+50 || m.y>H+50) METEORS.splice(i,1);
  }
}

// ---- Sparkle particles ----
function spawnParticle(x,y){
  PARTICLES.push({x,y, vx:(Math.random()-0.5)*20, vy:(Math.random()-0.8)*30, life:0.8, age:0, size:1+Math.random()*1.5});
}
function updateParticles(ctx, W, H, now){
  const dt = 1/60;
  for (let i=PARTICLES.length-1;i>=0;i--){
    const p = PARTICLES[i];
    p.age += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 10*dt; // slight gravity
    const a = Math.max(0, 1 - p.age/p.life);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,230,170,${a})`;
    ctx.shadowColor = 'rgba(255,210,120,0.8)'; ctx.shadowBlur = 8;
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    if (p.age>p.life) PARTICLES.splice(i,1);
  }
  ctx.shadowBlur = 0;
}

// ---- Aurora ----
function renderAurora(ctx, W, H, now, panX, panY){
  // Slightly lower so it is visible on tall phones, but still upper third
  const yBase = H*0.24 + Math.sin(now*0.0003)*10 + panY*14;
  const bands = 3;
  for (let b=0;b<bands;b++){
    const alpha = 0.08 + b*0.05;
    const hue = 260 + b*20; // purple/blue-ish
    ctx.beginPath();
    for (let x=0;x<=W;x+=16){
      const t = (x/W)*Math.PI*2;
      const y = yBase + Math.sin(t*1.6 + b + now*0.0004)*18 + Math.sin(t*3.3 + b*2 + now*0.0006)*6;
      if (x===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(W,0); ctx.lineTo(0,0); ctx.closePath();
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
    ctx.fill();
  }
}

// ---- Comets (slow, long tails) ----
const COMETS = [];
let lastComet = 0;
function spawnComet(W,H){
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -80 : W+80;
  const y = H*(0.25 + Math.random()*0.3);
  const speed = 60 + Math.random()*50;
  const dir = fromLeft ? 0 : Math.PI;
  COMETS.push({ x, y, vx: Math.cos(dir)*speed, vy: (Math.random()*20-10), age:0, life:20, trail:[] });
}
function updateComets(ctx, W, H, now){
  const t = now/1000;
  if (t - lastComet > 10 && COMETS.length < 2){ lastComet = t; spawnComet(W,H); }
  for (let i=COMETS.length-1;i>=0;i--){
    const c = COMETS[i];
    const dt = 1/60;
    c.age += dt; c.x += c.vx*dt; c.y += c.vy*dt;
    c.trail.unshift({x:c.x,y:c.y});
    if (c.trail.length>180) c.trail.pop();
    // tail
    ctx.lineWidth = 2.2; ctx.shadowBlur = 18; ctx.shadowColor = '#cbe7ff';
    for (let j=0;j<c.trail.length-1;j++){
      const a = (1 - j/c.trail.length)*0.55;
      ctx.strokeStyle = `rgba(200,230,255,${a})`;
      ctx.beginPath(); ctx.moveTo(c.trail[j].x, c.trail[j].y); ctx.lineTo(c.trail[j+1].x, c.trail[j+1].y); ctx.stroke();
    }
    // head
    ctx.beginPath(); ctx.fillStyle='rgba(230,245,255,0.95)'; ctx.arc(c.x, c.y, 3.2, 0, Math.PI*2); ctx.fill();
    if (c.x < -120 || c.x > W+120 || c.age > c.life) COMETS.splice(i,1);
  }
}
