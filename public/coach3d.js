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

function isVisible(el) {
  if (!el) return false;
  // Fast path: display:none ancestors -> offsetParent null (except fixed)
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8;
}

class Coach3DInstance {
  constructor({ THREE, canvas, context, fallbackImg }) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.fallbackImg = fallbackImg;

    this.mood = 'good'; // excellent | good | poor
    this.talking = false;
    this.talkEnergy = 0;
    this.talkBurst = 0;
    this.wasVisible = true;
    this.emote = { type: null, t0: 0, duration: 0 };
    this.focus = { x: 0, y: 0, has: false };
    this._gaze = { x: 0, y: 0, tNext: nowMs() + 650 + Math.random() * 900 };
    this.nextBlinkAt = nowMs() + 1200 + Math.random() * 1800;
    this.blinkUntil = 0;
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

    // Outline (cheap "high-end" toon look, no postprocessing)
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      side: THREE.BackSide
    });
    const bodyOutline = new THREE.Mesh(bodyGeo, outlineMat);
    bodyOutline.position.copy(body.position);
    bodyOutline.scale.set(1.06, 1.06, 1.06);
    root.add(bodyOutline);

    // Head group (for nod/shake)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.35, 0);
    root.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.6, 24, 18);
    const head = new THREE.Mesh(headGeo, skin);
    head.position.set(0, 0, 0);
    headGroup.add(head);

    const headOutline = new THREE.Mesh(headGeo, outlineMat);
    headOutline.position.copy(head.position);
    headOutline.scale.set(1.055, 1.055, 1.055);
    headGroup.add(headOutline);

    // Visor (hologram line)
    const visorGeo = new THREE.TorusGeometry(0.42, 0.035, 10, 48);
    const visor = new THREE.Mesh(visorGeo, accent);
    visor.position.set(0, 0.03, 0.55);
    visor.rotation.x = Math.PI / 2.7;
    headGroup.add(visor);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 14, 12);
    const eyeL = new THREE.Mesh(eyeGeo, accent);
    const eyeR = new THREE.Mesh(eyeGeo, accent2);
    eyeL.position.set(-0.18, 0.07, 0.56);
    eyeR.position.set(0.18, 0.07, 0.56);
    headGroup.add(eyeL, eyeR);

    // Mouth (simple plane that scales)
    const mouthGeo = new THREE.PlaneGeometry(0.22, 0.08);
    const mouth = new THREE.Mesh(mouthGeo, danger);
    mouth.position.set(0, -0.17, 0.62);
    headGroup.add(mouth);

    // HUD ring (adds premium "hologram" feel)
    const ringGeo = new THREE.RingGeometry(0.68, 0.72, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0.02, 0.2);
    ring.rotation.x = Math.PI / 2.3;
    headGroup.add(ring);

    // Arm (pointing gesture)
    const armGroup = new THREE.Group();
    armGroup.position.set(0.58, -0.15, 0.0);
    root.add(armGroup);
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 10), skin);
    upperArm.position.set(0, -0.2, 0);
    upperArm.rotation.z = Math.PI / 8;
    armGroup.add(upperArm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 12), accent);
    hand.position.set(0.18, -0.5, 0.05);
    armGroup.add(hand);

    const armOutline = new THREE.Mesh(upperArm.geometry, outlineMat);
    armOutline.position.copy(upperArm.position);
    armOutline.rotation.copy(upperArm.rotation);
    armOutline.scale.set(1.08, 1.08, 1.08);
    armGroup.add(armOutline);

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
    this.ring = ring;
    this.headGroup = headGroup;
    this.eyeL = eyeL;
    this.eyeR = eyeR;
    this.armGroup = armGroup;
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

  setFocus(x, y) {
    this.focus = { x: clamp(Number(x ?? 0), -1, 1), y: clamp(Number(y ?? 0), -1, 1), has: true };
  }

  clearFocus() {
    this.focus.has = false;
  }

  bumpTalk(chunk) {
    const s = String(chunk ?? '');
    if (!s) return;
    // Small burst on each streamed chunk; add extra punch for punctuation/newlines.
    let add = 0.55;
    if (/[。！？!?]/.test(s)) add += 0.45;
    if (/[\n\r]/.test(s)) add += 0.3;
    if (/[aeiouAEIOU]/.test(s)) add += 0.15;
    this.talkBurst = clamp(this.talkBurst + add, 0, 2.4);
  }

  emoteOnce(type) {
    const t = nowMs();
    const duration =
      type === 'nod' ? 900 :
      type === 'shake' ? 900 :
      type === 'point' ? 1100 :
      800;
    this.emote = { type, t0: t, duration };
  }

  tick() {
    const visible = isVisible(this.canvas);
    if (!visible) {
      this.wasVisible = false;
      return;
    }
    if (!this.wasVisible) {
      // Avoid a huge dt jump after being hidden.
      this.lastTick = nowMs();
      this.wasVisible = true;
    }

    const t = nowMs();
    const dt = clamp((t - this.lastTick) / 1000, 0, 0.05);
    this.lastTick = t;

    // subtle breathing + idle sway
    const time = t / 1000;
    this.root.rotation.y = Math.sin(time * 0.7) * 0.08;
    this.root.rotation.x = Math.cos(time * 0.9) * 0.04;
    this.root.position.y = Math.sin(time * 1.2) * 0.05;

    // ring rotation
    if (this.ring) this.ring.rotation.z = time * 0.9;

    // blink
    if (t >= this.nextBlinkAt) {
      this.blinkUntil = t + 110 + Math.random() * 80;
      this.nextBlinkAt = t + 1600 + Math.random() * 2200;
    }
    const blinking = t <= this.blinkUntil;
    if (this.eyeL && this.eyeR) {
      const sy = blinking ? 0.15 : 1.0;
      this.eyeL.scale.y = sy;
      this.eyeR.scale.y = sy;
    }

    // gaze: track pointer focus if provided, otherwise do micro saccades
    if (t >= this._gaze.tNext) {
      this._gaze = {
        x: (Math.random() - 0.5) * 0.6,
        y: (Math.random() - 0.5) * 0.4,
        tNext: t + 520 + Math.random() * 1200
      };
    }
    const fx = this.focus.has ? this.focus.x : this._gaze.x;
    const fy = this.focus.has ? this.focus.y : this._gaze.y;
    if (this.eyeL && this.eyeR) {
      const ox = clamp(fx, -1, 1) * 0.05;
      const oy = clamp(-fy, -1, 1) * 0.03;
      this.eyeL.position.x = -0.18 + ox;
      this.eyeR.position.x = 0.18 + ox;
      this.eyeL.position.y = 0.07 + oy;
      this.eyeR.position.y = 0.07 + oy;
    }

    // emotes: nod / shake / point
    if (this.emote?.type) {
      const p = clamp((t - this.emote.t0) / Math.max(1, this.emote.duration), 0, 1);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const wave = Math.sin(ease * Math.PI * 2);

      if (this.headGroup) {
        this.headGroup.rotation.x = 0;
        this.headGroup.rotation.y = 0;
      }
      if (this.armGroup) {
        this.armGroup.rotation.x = 0;
        this.armGroup.rotation.y = 0;
        this.armGroup.rotation.z = 0;
      }

      if (this.emote.type === 'nod' && this.headGroup) {
        this.headGroup.rotation.x = wave * 0.20;
      } else if (this.emote.type === 'shake' && this.headGroup) {
        this.headGroup.rotation.y = wave * 0.22;
      } else if (this.emote.type === 'point' && this.armGroup) {
        // Move arm forward/up like "指向下一步"
        this.armGroup.rotation.z = -0.45 + wave * 0.10;
        this.armGroup.rotation.x = 0.15;
        this.armGroup.rotation.y = -0.15;
      }

      if (p >= 1) {
        this.emote = { type: null, t0: 0, duration: 0 };
      }
    }

    // mouth animation while talking (energy + burst from stream chunks)
    const target = this.talking ? 1 : 0;
    this.talkEnergy += (target - this.talkEnergy) * (this.talking ? 8 : 10) * dt;
    this.talkBurst += (0 - this.talkBurst) * 6 * dt;
    const burst = clamp(this.talkBurst, 0, 1.4);
    const mouthOpen = 0.15 + (0.55 * burst) + Math.abs(Math.sin(time * 10.5)) * (0.25 + 0.15 * burst);
    const sY = 0.28 + 0.95 * this.talkEnergy * mouthOpen;
    const sX = 0.95 + 0.25 * this.talkEnergy * (0.4 + 0.6 * burst);
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
const pending = new Set();
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
  if (!isVisible(canvas)) {
    pending.add(canvasId);
    return null;
  }
  const context = getBestGLContext(canvas);
  if (!context) return null;

  const fallbackImg = fallbackImgId ? document.getElementById(fallbackImgId) : null;
  const THREE = await loadThree();
  try {
    const inst = new Coach3DInstance({ THREE, canvas, context, fallbackImg });
    instances.set(canvasId, inst);
    pending.delete(canvasId);
    if (fallbackImg) fallbackImg.classList.add('hidden');
    attachPointerTracking(canvasId);
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

export function bumpCoach3DTalk(canvasId, chunk) {
  const inst = instances.get(canvasId);
  inst?.bumpTalk?.(chunk);
}

export function emoteCoach3D(canvasId, type) {
  const inst = instances.get(canvasId);
  inst?.emoteOnce?.(type);
}

export function focusCoach3D(canvasId, x, y) {
  const inst = instances.get(canvasId);
  inst?.setFocus?.(x, y);
}

export function blurCoach3D(canvasId) {
  const inst = instances.get(canvasId);
  inst?.clearFocus?.();
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

export async function refreshCoach3D() {
  // Try to init any canvases that were hidden during initial load.
  const todo = Array.from(pending);
  for (const canvasId of todo) {
    const c = document.getElementById(canvasId);
    if (!isVisible(c)) continue;
    const fallbackImgId = c?.getAttribute?.('data-fallback-img') || '';
    // eslint-disable-next-line no-await-in-loop
    await initCoach3D({ canvasId, fallbackImgId: fallbackImgId || undefined });
  }

  // Resize all active instances (screen switch doesn't trigger window resize).
  for (const inst of instances.values()) inst._resize?.();
}

function attachPointerTracking(canvasId) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const host = c.closest('[data-cv-tilt]') || c.parentElement;
  if (!host) return;
  if (host.dataset.cvCoachTrack === '1') return;
  host.dataset.cvCoachTrack = '1';

  host.addEventListener('mousemove', (e) => {
    const rect = host.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    focusCoach3D(canvasId, x, y);
  });
  host.addEventListener('mouseleave', () => blurCoach3D(canvasId));
}

// Expose a stable global API for app-client.js to call.
window.CVCoach3D = {
  init: initAllCoach3D,
  initCoach3D,
  setMood: setCoach3DMood,
  setTalking: setCoach3DTalking,
  bump: bumpCoach3DTalk,
  emote: emoteCoach3D,
  focus: focusCoach3D,
  blur: blurCoach3D,
  refresh: refreshCoach3D
};
