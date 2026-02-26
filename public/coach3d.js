// 3D Toon Coach (no external model assets)
// - Uses Three.js from CDN (keeps repo light; matches existing CDN approach).
// - Renders into <canvas> for each coach panel; falls back to SVG if WebGL unavailable.

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function nowMs() {
  return performance?.now?.() ?? Date.now();
}

function getBestGLContext(canvas) {
  const opts = {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  };
  try {
    // IMPORTANT: try WebGL2 first; calling getContext('webgl') first will lock the canvas to WebGL1.
    return canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  } catch {
    return null;
  }
}

async function loadThree() {
  if (window.__cv_three) return window.__cv_three;
  // eslint-disable-next-line no-return-assign
  return (window.__cv_three = import(THREE_CDN));
}

class Coach3DInstance {
  constructor({ THREE, canvas, context, fallbackImg }) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.fallbackImg = fallbackImg;

    this.mood = 'good'; // excellent | good | poor
    this.talking = false;
    this.talkEnergy = 0;
    this.lastTick = nowMs();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    camera.position.set(0, 0.15, 3.2);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.6, 2.2, 2.8);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x22d3ee, 0.85);
    rim.position.set(-2.6, 1.6, -1.6);
    scene.add(rim);

    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext;
    // WebGL1 Toon shader uses fwidth() -> requires OES_standard_derivatives enabled.
    if (!isWebGL2) renderer.extensions.get('OES_standard_derivatives');

    // Toon materials
    const skin = new THREE.MeshToonMaterial({ color: 0x0b1220 });
    const accent = new THREE.MeshToonMaterial({ color: 0x22d3ee });
    const accent2 = new THREE.MeshToonMaterial({ color: 0xa78bfa });
    const danger = new THREE.MeshToonMaterial({ color: 0xf43f5e });
    // Ensure shader includes derivatives extension directive on WebGL1.
    for (const m of [skin, accent, accent2, danger]) {
      m.extensions = { ...(m.extensions ?? {}), derivatives: true };
    }

    // Character group
    const root = new THREE.Group();
    scene.add(root);

    // Body (capsule-ish)
    const bodyGeo = new THREE.CapsuleGeometry(0.55, 0.75, 6, 14);
    const body = new THREE.Mesh(bodyGeo, skin);
    body.position.set(0, -0.6, 0);
    root.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.6, 24, 18);
    const head = new THREE.Mesh(headGeo, skin);
    head.position.set(0, 0.35, 0);
    root.add(head);

    // Visor (hologram line)
    const visorGeo = new THREE.TorusGeometry(0.42, 0.035, 10, 48);
    const visor = new THREE.Mesh(visorGeo, accent);
    visor.position.set(0, 0.38, 0.55);
    visor.rotation.x = Math.PI / 2.7;
    root.add(visor);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 14, 12);
    const eyeL = new THREE.Mesh(eyeGeo, accent);
    const eyeR = new THREE.Mesh(eyeGeo, accent2);
    eyeL.position.set(-0.18, 0.42, 0.56);
    eyeR.position.set(0.18, 0.42, 0.56);
    root.add(eyeL, eyeR);

    // Mouth (simple plane that scales)
    const mouthGeo = new THREE.PlaneGeometry(0.22, 0.08);
    const mouth = new THREE.Mesh(mouthGeo, danger);
    mouth.position.set(0, 0.18, 0.62);
    root.add(mouth);

    // Floating particles
    const particleCount = 18;
    const particles = [];
    const pGeo = new THREE.SphereGeometry(0.03, 10, 10);
    for (let i = 0; i < particleCount; i += 1) {
      const m = new THREE.Mesh(pGeo, i % 3 === 0 ? danger : i % 2 === 0 ? accent : accent2);
      m.position.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2);
      m.userData = {
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8
      };
      root.add(m);
      particles.push(m);
    }

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.root = root;
    this.rim = rim;
    this.visor = visor;
    this.mouth = mouth;
    this.particles = particles;
    this.accent = accent;
    this.accent2 = accent2;
    this.danger = danger;

    this._resize();
  }

  _resize() {
    const { canvas, renderer, camera } = this;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  setMood(level) {
    this.mood = level === 'excellent' ? 'excellent' : level === 'poor' ? 'poor' : 'good';
    if (this.mood === 'excellent') {
      this.rim.color.setHex(0x10b981);
      this.rim.intensity = 0.95;
      this.visor.material = this.accent;
    } else if (this.mood === 'poor') {
      this.rim.color.setHex(0xf43f5e);
      this.rim.intensity = 0.95;
      this.visor.material = this.danger;
    } else {
      this.rim.color.setHex(0x22d3ee);
      this.rim.intensity = 0.85;
      this.visor.material = this.accent;
    }
  }

  setTalking(on) {
    this.talking = Boolean(on);
    if (!this.talking) this.talkEnergy = 0;
  }

  tick() {
    const t = nowMs();
    const dt = clamp((t - this.lastTick) / 1000, 0, 0.05);
    this.lastTick = t;

    // subtle breathing + idle sway
    const time = t / 1000;
    this.root.rotation.y = Math.sin(time * 0.7) * 0.08;
    this.root.rotation.x = Math.cos(time * 0.9) * 0.04;
    this.root.position.y = Math.sin(time * 1.2) * 0.05;

    // mouth animation while talking
    const target = this.talking ? 1 : 0;
    this.talkEnergy += (target - this.talkEnergy) * (this.talking ? 8 : 10) * dt;
    const mouthOpen = 0.25 + Math.abs(Math.sin(time * 10)) * 0.75;
    const sY = 0.35 + 0.9 * this.talkEnergy * mouthOpen;
    const sX = 0.9 + 0.2 * this.talkEnergy;
    this.mouth.scale.set(sX, sY, 1);

    // particles orbit
    for (const p of this.particles) {
      const ph = p.userData.phase;
      const sp = p.userData.speed;
      p.position.x += Math.cos(time * sp + ph) * 0.002;
      p.position.y += Math.sin(time * sp * 1.1 + ph) * 0.002;
      p.position.z += Math.sin(time * sp * 0.9 + ph) * 0.002;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

const instances = new Map();
let rafId = null;

function ensureLoop() {
  if (rafId) return;
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    for (const inst of instances.values()) inst.tick();
  };
  rafId = requestAnimationFrame(loop);
}

function bindResize() {
  if (window.__cv_coach3d_resize_bound) return;
  window.__cv_coach3d_resize_bound = true;
  window.addEventListener('resize', () => {
    for (const inst of instances.values()) inst._resize();
  });
}

export async function initCoach3D({ canvasId, fallbackImgId }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const context = getBestGLContext(canvas);
  if (!context) return null;

  const fallbackImg = fallbackImgId ? document.getElementById(fallbackImgId) : null;
  if (fallbackImg) fallbackImg.classList.add('hidden');

  const THREE = await loadThree();
  try {
    const inst = new Coach3DInstance({ THREE, canvas, context, fallbackImg });
    instances.set(canvasId, inst);
    ensureLoop();
    bindResize();
    return inst;
  } catch {
    // If shader/driver fails, fall back to SVG.
    if (fallbackImg) fallbackImg.classList.remove('hidden');
    return null;
  }
}

export function setCoach3DMood(canvasId, level) {
  const inst = instances.get(canvasId);
  inst?.setMood?.(level);
}

export function setCoach3DTalking(canvasId, on) {
  const inst = instances.get(canvasId);
  inst?.setTalking?.(on);
}

export async function initAllCoach3D() {
  const canvases = Array.from(document.querySelectorAll('canvas[data-cv-coach3d="1"]'));
  for (const c of canvases) {
    const canvasId = c.id;
    const fallbackImgId = c.getAttribute('data-fallback-img') || '';
    // eslint-disable-next-line no-await-in-loop
    await initCoach3D({ canvasId, fallbackImgId: fallbackImgId || undefined });
  }
}

// Expose a stable global API for app-client.js to call.
window.CVCoach3D = {
  init: initAllCoach3D,
  initCoach3D,
  setMood: setCoach3DMood,
  setTalking: setCoach3DTalking
};
