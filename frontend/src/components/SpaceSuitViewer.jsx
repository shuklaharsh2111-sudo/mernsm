import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/astronaut.glb`;

/*
  Static astronaut (upper body only) whose head follows the cursor.

  Lag-free by design:
  - the .glb is ~3 MB (animation removed, geometry meshopt-compressed, 1024px WebP textures)
  - nothing renders while the cursor is still: a frame is drawn only while the head is moving
  - pixel ratio capped at 1.75, no shadows, no post-processing, 3 cheap lights
  - no auto-rotate, no orbit controls, canvas ignores pointer events
*/

// ---- framing (metres; the model is ~2.06 m tall, stands on y = 0 and faces +Z)
const TARGET_Y = 1.72;  // what the camera looks at (chest / head)
const VISIBLE_H = 0.78; // minimum height shown
const HALF_W = 0.30;    // half-width that must fit

// ---- head motion
const HEAD_BONE = 'CC_Base_Head_038';
const MAX_YAW = THREE.MathUtils.degToRad(36);
const MAX_PITCH_UP = THREE.MathUtils.degToRad(20);
const MAX_PITCH_DOWN = THREE.MathUtils.degToRad(14);
const FOLLOW_SPEED = 9; // higher = snappier
const EPS = 0.0004;     // radians: below this the head counts as settled

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SpaceSuitViewer = () => {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setLoading(false);
      return undefined; // WebGL not available: show nothing
    }

    let disposed = false;
    let raf = 0;
    let last = 0;
    let head = null;
    let gltfScene = null;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);

    // plain neutral lighting - the baked textures carry the colour
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(3, 1, 3);
    scene.add(fill);

    // ---- head rig (axis-agnostic: works whatever the bone's local axes are)
    const restLocal = new THREE.Quaternion();
    const parentWorld = new THREE.Quaternion();
    const parentWorldInv = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion();
    const qPitch = new THREE.Quaternion();
    const delta = new THREE.Quaternion();

    const applyHead = (yaw, pitch) => {
      if (!head) return;
      qYaw.setFromAxisAngle(AXIS_Y, yaw);      // + = look to the right of the screen
      qPitch.setFromAxisAngle(AXIS_X, -pitch); // + = look up
      delta.copy(qYaw).multiply(qPitch);       // rotation in world axes
      // local = parentWorld^-1 * delta * parentWorld * restLocal
      head.quaternion
        .copy(parentWorldInv)
        .multiply(delta)
        .multiply(parentWorld)
        .multiply(restLocal);
    };

    // ---- camera fit
    const fitCamera = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const distH = (VISIBLE_H / 2) / Math.tan(halfFov);
      const distW = HALF_W / (Math.tan(halfFov) * camera.aspect);
      camera.position.set(0, TARGET_Y, Math.max(distH, distW));
      camera.lookAt(0, TARGET_Y, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    // ---- cursor -> target angles, eased; frames are drawn only while moving
    const state = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };

    const tick = (now) => {
      raf = 0;
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const k = 1 - Math.exp(-FOLLOW_SPEED * dt);
      state.yaw += (state.tYaw - state.yaw) * k;
      state.pitch += (state.tPitch - state.pitch) * k;
      applyHead(state.yaw, state.pitch);
      renderer.render(scene, camera);
      if (Math.abs(state.tYaw - state.yaw) > EPS || Math.abs(state.tPitch - state.pitch) > EPS) {
        raf = requestAnimationFrame(tick);
      }
    };
    const requestFrame = () => {
      if (raf || disposed) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const setTarget = (clientX, clientY) => {
      const r = mount.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.3; // roughly where the head sits on screen
      // normalised by half the window so the whole screen maps to the full range
      const nx = clamp((clientX - cx) / (window.innerWidth * 0.5), -1, 1);
      const ny = clamp((cy - clientY) / (window.innerHeight * 0.5), -1, 1);
      state.tYaw = nx * MAX_YAW;
      state.tPitch = ny >= 0 ? ny * MAX_PITCH_UP : ny * MAX_PITCH_DOWN;
      requestFrame();
    };
    const recentre = () => {
      state.tYaw = 0;
      state.tPitch = 0;
      requestFrame();
    };

    const onMove = (e) => setTarget(e.clientX, e.clientY);
    const onUp = (e) => { if (e.pointerType !== 'mouse') recentre(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', recentre, { passive: true });
    document.documentElement.addEventListener('pointerleave', recentre);

    // ---- load the model
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        gltfScene = gltf.scene;
        const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        gltfScene.traverse((child) => {
          if (!child.isMesh) return;
          child.frustumCulled = false; // skinned bounds don't follow the head
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (m.map) m.map.anisotropy = aniso;
          });
        });
        scene.add(gltfScene);

        head = gltfScene.getObjectByName(HEAD_BONE);
        if (head) {
          gltfScene.updateMatrixWorld(true);
          restLocal.copy(head.quaternion);
          head.parent.getWorldQuaternion(parentWorld);
          parentWorldInv.copy(parentWorld).invert();
        }

        fitCamera();
        setLoading(false);
        setReady(true);
      },
      undefined,
      () => setLoading(false)
    );

    fitCamera();
    const observer = new ResizeObserver(fitCamera);
    observer.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', recentre);
      document.documentElement.removeEventListener('pointerleave', recentre);
      if (gltfScene) {
        gltfScene.traverse((c) => {
          if (!c.isMesh) return;
          c.geometry.dispose();
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => {
            m.map?.dispose();
            m.dispose();
          });
        });
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`nl-model${ready ? ' is-ready' : ''}`} ref={mountRef}>
      {loading && <span className="nl-model-loading">Loading 3D model…</span>}
    </div>
  );
};

export default SpaceSuitViewer;
