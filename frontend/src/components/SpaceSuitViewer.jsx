import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/spacesuit.obj`;

/**
 * Slowly rotating 3D astronaut. Drag to rotate, no zoom/pan.
 * Fills its parent (parent must be position: relative with a size).
 */
const SpaceSuitViewer = () => {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);

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
    let frameId = 0;
    let modelSize = new THREE.Vector3(1.12, 2, 0.63);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.1, 6);

    // Soft studio reflections + warm key / orange rim lights
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff7a1a, 2.6);
    rim.position.set(4, 2, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.minPolarAngle = Math.PI / 2 - 0.35;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;

    const fitCamera = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const margin = 1.12;
      const distH = (modelSize.y / 2) * margin / Math.tan(halfFov);
      const distW = (Math.max(modelSize.x, modelSize.z) / 2) * margin /
        (Math.tan(halfFov) * camera.aspect);
      const dist = Math.max(distH, distW) + modelSize.z / 2;
      camera.position.setLength(dist);
      camera.updateProjectionMatrix();
    };

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xff6a13,
      roughness: 0.42,
      metalness: 0.12,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.9,
      side: THREE.DoubleSide,
    });

    const group = new THREE.Group();
    scene.add(group);

    new OBJLoader().load(
      MODEL_URL,
      (obj) => {
        if (disposed) {
          obj.traverse((c) => c.isMesh && c.geometry.dispose());
          return;
        }
        obj.traverse((child) => {
          if (child.isMesh) child.material = material;
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

        // the model faces -Z by default: turn it to face the camera
        group.rotation.y = Math.PI;

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
    <div className="nl-model" ref={mountRef}>
      {loading && <span className="nl-model-loading">Loading 3D model…</span>}
    </div>
  );
};

export default SpaceSuitViewer;
