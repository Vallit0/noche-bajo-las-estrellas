const video = document.getElementById('camera');
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
const btnCamera = document.getElementById('btnCamera');
const btnGyro = document.getElementById('btnGyro');
const toggleLines = document.getElementById('toggleLines');

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

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// Auto-start camera if possible
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
  startCamera();
}

// Helpful tips in console
console.log('%cTip','background:#f2a900;color:#1a0b00;padding:2px 6px;border-radius:6px','Para iOS, toca "Activar brújula" para habilitar orientación.');

