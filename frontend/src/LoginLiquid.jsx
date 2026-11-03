import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  Liquid orange/black chrome art panel (lightweight build).
  - one large mirror-silver blob + small droplets
  - leans toward the cursor, bulges where the cursor points, wobbles with pointer speed
  - droplets are pulled toward the cursor like surface tension
    away and flicks droplets off, which then pull back and merge by surface tension
  - reacts to the form: typing pulses it, focus speeds it up, loading churns it, errors calm it

  Performance:
  - indexed (merged-vertex) geometry: ~17k verts for the blob instead of ~195k
  - frame-rate independent motion, adaptive render resolution, optional 30fps cap
  - pauses when hidden / off-screen; tells the page to switch to a lite look if the GPU is slow
*/

const noise = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uAmp;
  uniform float uWobble;
  uniform float uHover;
  uniform vec3 uDir;
  varying vec3 vN;
  varying vec3 vPos;
  ${noise}

  vec3 displace(vec3 p) {
    float t = uTime * 0.45 + uSeed;
    float d = (snoise(p * 0.85 + vec3(0.0, t, t * 0.6)) * 0.24
             + snoise(p * 1.7 - vec3(t, 0.0, t)) * 0.035) * uAmp * (1.0 + uWobble);
    // the surface reaches toward the cursor
    float bulge = uHover * pow(max(dot(normalize(p), uDir), 0.0), 5.0) * 0.5;
    return p + p * (d + bulge);
  }

  void main() {
    vec3 n = normalize(position);
    vec3 t = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b = cross(n, t);
    float e = 0.02;

    vec3 p0 = displace(n);
    vec3 p1 = displace(normalize(n + t * e));
    vec3 p2 = displace(normalize(n + b * e));
    vec3 dn = normalize(cross(p1 - p0, p2 - p0));
    if (dot(dn, n) < 0.0) dn = -dn;

    vN = normalize(normalMatrix * dn);
    vPos = p0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vPos;

  // fake studio environment: black floor, orange body, bright overhead strip
  vec3 env(vec3 r) {
    float h = r.y * 0.5 + 0.5;
    vec3 floorC = vec3(0.025, 0.02, 0.02);
    vec3 midC   = vec3(0.98, 0.40, 0.04);
    vec3 skyC   = vec3(1.00, 0.84, 0.62);
    vec3 c = mix(floorC, midC, smoothstep(0.15, 0.55, h));
    c = mix(c, skyC, smoothstep(0.55, 0.95, h));

    c += vec3(1.0) * smoothstep(0.82, 0.96, dot(r, normalize(vec3(-0.6, 0.55, 0.6)))) * 0.9;
    c += vec3(1.0, 0.62, 0.25) * smoothstep(0.88, 0.98, dot(r, normalize(vec3(0.7, 0.2, 0.7)))) * 0.7;

    c *= 0.82 + 0.18 * smoothstep(0.0, 0.03, abs(r.y - 0.08));
    return c;
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 R = reflect(-V, N);

    vec3 col = env(R);

    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    col = mix(col, vec3(1.0, 0.78, 0.5), fres * 0.4);
    col += (0.5 + 0.5 * cos(6.28318 * (vPos.y * 0.25 + vec3(0.0, 0.1, 0.2) + uTime * 0.03))) * 0.02;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// frame-rate independent easing: same feel at 20fps and 144fps
// (k = -60 * ln(1 - perFrameFactor) matches the original 60fps per-frame factors)
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// render-resolution caps; the loop steps down this list when frames are slow
const QUALITY = [1.5, 1, 0.75, 0.6];
const MAX_LEVEL = QUALITY.length - 1;

function makeMaterial(seed, amp) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uAmp: { value: amp },
      uWobble: { value: 0 },
      uHover: { value: 0 },
      uDir: { value: new THREE.Vector3(0, 0, 1) },
    },
  });
}

// the shader only needs positions, so drop normals/uvs and weld shared vertices
function makeGeometry(detail) {
  const raw = new THREE.IcosahedronGeometry(1, detail);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const geo = mergeVertices(raw);
  raw.dispose();
  return geo;
}

const LoginLiquid = ({ mode = 'idle', pulse = 0, onLowPerf }) => {
  const mountRef = useRef(null);
  const modeRef = useRef(mode);
  const pulseRef = useRef(pulse);
  const lowPerfRef = useRef(onLowPerf);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    pulseRef.current = pulse;
  }, [pulse]);

  useEffect(() => {
    lowPerfRef.current = onLowPerf;
  }, [onLowPerf]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = window.devicePixelRatio || 1;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: dpr < 2, // hi-dpi screens don't need MSAA
        alpha: true,
        stencil: false,
        powerPreference: 'low-power',
      });
    } catch {
      lowPerfRef.current?.(); // no WebGL: the panel's CSS background still looks fine
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    camera.position.z = 5.2;
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

    const geo = makeGeometry(48);
    const dropGeo = makeGeometry(20);
    const mats = [makeMaterial(0, 1), makeMaterial(7.3, 0.55), makeMaterial(13.1, 0.55)];
    const main = new THREE.Mesh(geo, mats[0]);
    const drop1 = new THREE.Mesh(dropGeo, mats[1]);
    const drop2 = new THREE.Mesh(dropGeo, mats[2]);
    [main, drop1, drop2].forEach((mesh) => { mesh.frustumCulled = false; });
    main.scale.setScalar(0.82);
    drop1.scale.setScalar(0.2);
    drop2.scale.setScalar(0.13);
    drop1.position.set(1, 0.6, 0.2);
    drop2.position.set(-1, -0.7, 0.2);

    const root = new THREE.Group();
    root.add(main, drop1, drop2);
    scene.add(root);

    // ---- sizing / adaptive quality
    let aspect = 1;
    let rect = mount.getBoundingClientRect();
    const resize = () => {
      const w = mount.clientWidth || 400;
      const h = mount.clientHeight || 500;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      root.scale.setScalar(clamp(aspect * 1.3, 0.55, 1));
      rect = mount.getBoundingClientRect();
    };
    let level = 0;
    const applyQuality = () => {
      renderer.setPixelRatio(Math.min(dpr, QUALITY[level]));
      resize();
    };
    applyQuality();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    const updateRect = () => { rect = mount.getBoundingClientRect(); };
    window.addEventListener('scroll', updateRect, { passive: true, capture: true });

    // ---- pointer
    const ptr = { x: 0, y: 0, has: false };
    let moveAcc = 0;
    let kick = 0;
    const onMove = (e) => {
      if (ptr.has) moveAcc += Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y);
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.has = true;
    };
    const onLeave = () => { ptr.has = false; };
    const onUp = (e) => { if (e.pointerType !== 'mouse') ptr.has = false; };
    const onDown = (e) => {
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        kick = Math.max(kick, 1.2);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    // ---- state
    let running = false;
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let speed = 1;
    let size = 0.82;
    let lastPulse = pulseRef.current;
    let wobble = 0;
    let hover = 0;
    const off = new THREE.Vector2();
    const cursorW = new THREE.Vector2();
    const dir = new THREE.Vector3(0, 0, 1);

    // perf monitor
    let warm = 45;
    let accT = 0;
    let accN = 0;
    let slowWindows = 0;

    const frame = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      if (level >= MAX_LEVEL && now - last < 30) return; // 30fps cap on slow machines
      const rawDt = Math.max(0, (now - last) / 1000);
      last = now;
      const dt = Math.min(rawDt, 0.05);
      if (dt <= 0) return;

      // --- adaptive resolution
      if (warm > 0) {
        warm -= 1;
      } else {
        accT += rawDt;
        accN += 1;
        if (accN >= 45) {
          const avg = accT / accN;
          accT = 0;
          accN = 0;
          slowWindows = avg > 0.028 ? slowWindows + 1 : 0;
          if (slowWindows >= 2 && level < MAX_LEVEL) {
            slowWindows = 0;
            level += 1;
            applyQuality();
            warm = 20;
            if (level === MAX_LEVEL) lowPerfRef.current?.();
          }
        }
      }

      const m = modeRef.current;
      const wantSpeed = m === 'loading' ? 4.5 : m === 'focus' ? 1.8 : m === 'error' ? 0.35 : 1;
      speed = damp(speed, wantSpeed, 3.7, dt);
      time += dt * speed;

      if (pulseRef.current !== lastPulse) {
        lastPulse = pulseRef.current;
        kick = Math.max(kick, 0.9);
      }
      kick *= Math.exp(-5 * dt);

      // cursor in panel space (-1..1), blob lean + hover strength
      const r = rect;
      let px = 0;
      let py = 0;
      let near = 0;
      if (ptr.has) {
        px = ((ptr.x - (r.left + r.width / 2)) / (r.width / 2));
        py = -((ptr.y - (r.top + r.height / 2)) / (r.height / 2));
        near = 1 - smooth(0.4, 2.2, Math.hypot(px, py));
      }
      hover = damp(hover, near, 4.5, dt);

      const lean = 0.28;
      off.x = damp(off.x, clamp(px, -1, 1) * lean * near, 3.7, dt);
      off.y = damp(off.y, clamp(py, -1, 1) * lean * near, 3.7, dt);
      main.position.set(off.x, off.y, 0);

      cursorW.set(clamp(px, -1.1, 1.1) * halfH * aspect * 0.9, clamp(py, -1.1, 1.1) * halfH * 0.9);
      dir.set(cursorW.x - off.x, cursorW.y - off.y, 1.1).normalize();

      // speed of the pointer -> surface wobble
      const v = moveAcc / Math.max(dt * 60, 0.5);
      moveAcc = 0;
      wobble = damp(wobble, clamp(v * 0.012, 0, 1.1), 6.3, dt);

      // droplets: orbit when idle, get pulled toward the cursor when it is near
      const o1x = Math.cos(time * 0.55) * 1.05;
      const o1y = Math.sin(time * 0.8) * 0.95;
      const o2x = Math.cos(time * 0.4 + 2.4) * 1.0;
      const o2y = Math.sin(time * 0.65 + 1.3) * 1.1;
      const pull1 = near * 0.85;
      const pull2 = near * 0.6;
      drop1.position.x = damp(drop1.position.x, o1x + (cursorW.x - o1x) * pull1, 2.8, dt);
      drop1.position.y = damp(drop1.position.y, o1y + (cursorW.y - o1y) * pull1, 2.8, dt);
      drop2.position.x = damp(drop2.position.x, o2x + (cursorW.x - o2x) * pull2, 1.7, dt);
      drop2.position.y = damp(drop2.position.y, o2y + (cursorW.y - o2y) * pull2, 1.7, dt);
      // keep droplets on screen
      [drop1, drop2].forEach((d) => {
        d.position.x = clamp(d.position.x, -halfH * aspect * 0.92, halfH * aspect * 0.92);
        d.position.y = clamp(d.position.y, -halfH * 0.92, halfH * 0.92);
      });

      let want = 0.82 * (1 + kick * 0.12);
      if (m === 'focus') want *= 1.05;
      if (m === 'loading') want *= 1 + 0.05 * Math.sin(time * 6);
      if (m === 'error') want *= 0.92;
      size = damp(size, want, 10.5, dt);
      main.scale.setScalar(size);

      mats.forEach((mat, i) => {
        const u = mat.uniforms;
        u.uTime.value = time;
        u.uWobble.value = i === 0 ? wobble : wobble * 0.5;
        u.uHover.value = i === 0 ? hover : 0;
        u.uDir.value.copy(dir);
      });

      renderer.render(scene, camera);
    };

    // run only while the tab is visible and the panel is on screen
    let onScreen = true;
    const sync = () => {
      const should = onScreen && !document.hidden && !reduceMotion;
      if (should && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    let io;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      });
      io.observe(mount);
    }
    document.addEventListener('visibilitychange', sync);

    if (reduceMotion) {
      mats.forEach((mat) => { mat.uniforms.uTime.value = 2; });
      renderer.render(scene, camera);
    } else {
      sync();
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      window.removeEventListener('scroll', updateRect, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', sync);
      geo.dispose();
      dropGeo.dispose();
      mats.forEach((mat) => mat.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="lx-liquid" aria-hidden="true" />;
};

export default LoginLiquid;