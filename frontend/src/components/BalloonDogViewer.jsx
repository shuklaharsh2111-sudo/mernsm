import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/balloon_dog.glb`;

/**
 * Slowly rotating, glossy orange balloon dog. Drag to rotate, no zoom/pan.
 * Fills its parent (parent must be position: relative with a size).
 */
const BalloonDogViewer = () => {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() => setLoading(false));
      return undefined; // WebGL not available: show nothing
    }

    let disposed = false;
    let frameId = 0;
    let modelSize = new THREE.Vector3(1, 2, 1);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.25, 6);

    // soft studio reflections (what makes a balloon look like a balloon) + key / rim lights
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const key = new THREE.DirectionalLight(0xfff0e0, 1.5);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff7a1a, 2.4);
    rim.position.set(4, 2, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;
    controls.minPolarAngle = Math.PI / 2 - 0.4;
    controls.maxPolarAngle = Math.PI / 2 + 0.3;

    const fitCamera = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const margin = 1.08;
      // the dog turns, so it is widest (its full length) when seen from the side
      const length = Math.max(modelSize.x, modelSize.z);
      const distH = (modelSize.y / 2) * margin / Math.tan(halfFov);
      const distW = (length / 2) * margin / (Math.tan(halfFov) * camera.aspect);
      const dist = Math.max(distH, distW) + length * 0.12;
      camera.position.setLength(dist);
      camera.updateProjectionMatrix();
    };

    // glossy orange balloon skin, replaces the model's own grey metal material
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xff5200,
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.75,
      side: THREE.DoubleSide,
    });

    const group = new THREE.Group();
    scene.add(group);

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        const obj = gltf.scene;
        if (disposed) {
          obj.traverse((c) => c.isMesh && c.geometry.dispose());
          return;
        }
        obj.traverse((child) => {
          if (child.isMesh) {
            const old = child.material;
            child.material = material;
            if (old && old !== material) old.dispose();
          }
        });

        // centre the model and scale it to a height of 2 units
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 2 / size.y;
        obj.position.sub(center);
        group.add(obj);
        group.scale.setScalar(scale);
        modelSize = size.multiplyScalar(scale);

        // start on a 3/4 view instead of head-on (it keeps turning from here)
        group.rotation.y = -Math.PI / 3;

        fitCamera();
        setLoading(false);
      },
      undefined,
      () => setLoading(false)
    );

    fitCamera();
    const observer = new ResizeObserver(fitCamera);
    observer.observe(mount);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      group.traverse((c) => c.isMesh && c.geometry.dispose());
      material.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="nl-dog" ref={mountRef}>
      {loading && <span className="nl-dog-loading">Loading 3D model…</span>}
    </div>
  );
};

export default BalloonDogViewer;
