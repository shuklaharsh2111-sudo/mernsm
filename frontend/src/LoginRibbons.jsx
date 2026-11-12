import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/*
  Red neon ribbon background for the login left box (same look as the
  "coming soon" page). One full-screen quad + a fragment shader, so it is very light:
  - capped pixel ratio, resizes with the box
  - pauses when the tab is hidden or the box is off-screen
  - respects prefers-reduced-motion (draws a single still frame)
*/

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;

  // one ribbon layer: returns colour for a coordinate "s" running across the ribbons
  vec3 ribbon(float s) {
    float f = fract(s);
    vec3 col = vec3(0.01, 0.0, 0.0);

    // dark gap -> deep red body -> hot red edge
    float body = smoothstep(0.28, 0.62, f) * (1.0 - smoothstep(0.80, 0.86, f));
    vec3 bodyCol = mix(vec3(0.22, 0.0, 0.0), vec3(1.0, 0.12, 0.03), smoothstep(0.30, 0.82, f));
    col = mix(col, bodyCol, body);

    // orange glow on the edge + thin yellow line
    col += vec3(1.0, 0.45, 0.08) * smoothstep(0.78, 0.86, f) * (1.0 - smoothstep(0.86, 0.90, f)) * 0.9;
    col += vec3(1.0, 0.9, 0.25) * smoothstep(0.868, 0.876, f) * (1.0 - smoothstep(0.882, 0.892, f));

    // fine bright lines running along the red body ("grass" texture)
    float fine = smoothstep(0.80, 0.95, sin(s * 95.0) * 0.5 + 0.5);
    col += vec3(1.0, 0.7, 0.3) * fine * body * 0.35;
    return col;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

    // gentle parallax toward the cursor
    p += (uMouse - 0.5) * vec2(0.05, -0.05);

    // concentric rings: distance from the centre drives the ribbon coordinate,
    // so the ribbons flow in circles from the centre outwards
    float r = length(p);
    float ang = atan(p.y, p.x);
    float t = uTime;
    // gentle breathing wobble so the circles are not perfectly rigid
    float warp = 0.035 * sin(ang * 3.0 + t * 0.5) + 0.02 * sin(ang * 5.0 - t * 0.35);
    float s = (r + warp) * 5.2 - t * 0.22;

    vec3 col = ribbon(s);

    // second, softer layer for depth (parallax)
    vec3 back = ribbon(s * 0.62 + 3.7 + t * 0.05) * 0.28;
    col = max(col, back);

    // blurred bloom copy
    vec3 glow = ribbon(s + 0.04) * 0.0 + vec3(1.0, 0.1, 0.0) * 0.10 * smoothstep(0.35, 0.8, fract(s));
    col += glow;

    // darker toward the centre so the astronaut reads, bright toward the edges
    vec2 c = p / vec2(max(aspect, 0.6) * 0.5, 0.5);
    float edge = smoothstep(0.15, 1.05, length(c));
    col *= mix(0.22, 1.0, edge);

    // subtle top/bottom falloff
    col *= 0.75 + 0.25 * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const LoginRibbons = () => {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    } catch {
      return undefined; // no WebGL: the CSS background behind stays visible
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const target = new THREE.Vector2(0.5, 0.5);
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      target.set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      uniforms.uTime.value += dt;
      uniforms.uMouse.value.lerp(target, 1 - Math.pow(0.001, dt));
      renderer.render(scene, camera);
    };
    if (reduced) {
      uniforms.uTime.value = 2.0;
      renderer.render(scene, camera);
    } else {
      tick();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="nl-three" aria-hidden="true" />;
};

export default LoginRibbons;