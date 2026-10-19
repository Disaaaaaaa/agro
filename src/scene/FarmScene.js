import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CROPS } from '../data.js';

const FIELD_W = 20;
const FIELD_D = 13;
const ROAD_Z = FIELD_D / 2 + 1.5;
const CANAL_Z = -FIELD_D / 2 - 1.3;

const ENV = {
  dry: {
    sky: '#F5DBAE', fog: '#F2D6A6', ground: '#C4B66A', soil: '#B58A57',
    sun: 3.4, sunColor: '#FFDDA0', hemi: 0.85, clouds: 1.5, cloudColor: '#FFF8EE',
    rain: 0, water: 0.45, wind: 0.6, sunScale: 1.35,
  },
  normal: {
    sky: '#BEE3F8', fog: '#D3ECF8', ground: '#8DC56C', soil: '#8D6542',
    sun: 2.6, sunColor: '#FFF2D8', hemi: 1.0, clouds: 5, cloudColor: '#FFFFFF',
    rain: 0, water: 1, wind: 1, sunScale: 1,
  },
  rainy: {
    sky: '#A5B8C8', fog: '#B4C4D1', ground: '#5DAE50', soil: '#6A4A31',
    sun: 1.3, sunColor: '#E4ECF4', hemi: 1.15, clouds: 10, cloudColor: '#C3CDD6',
    rain: 1, water: 1.3, wind: 1.9, sunScale: 0.8,
  },
};

const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));

/* ---------- геометрия көмекшілері ---------- */

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function part(geo, hex, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  if (geo.index) geo = geo.toNonIndexed();
  geo.rotateX(rx);
  geo.rotateY(ry);
  geo.rotateZ(rz);
  geo.translate(x, y, z);
  return paint(geo, hex);
}

let cropGeoCache = null;
function cropGeometries() {
  if (cropGeoCache) return cropGeoCache;
  const wheat = mergeGeometries(
    [
      [-0.09, 0.0, 0.62],
      [0.08, 0.06, 0.7],
      [0.0, -0.09, 0.56],
      [0.1, -0.06, 0.5],
    ].flatMap(([x, z, h]) => [
      part(new THREE.CylinderGeometry(0.015, 0.02, h, 3), '#C9A64A', { x, z, y: h / 2 }),
      part(new THREE.ConeGeometry(0.05, 0.24, 4), '#EBC14A', { x, z, y: h + 0.08, rx: Math.PI }),
    ])
  );
  const corn = mergeGeometries([
    part(new THREE.CylinderGeometry(0.045, 0.07, 1.5, 5), '#5E9E36', { y: 0.75 }),
    part(new THREE.BoxGeometry(0.6, 0.025, 0.12), '#78B544', { y: 0.55, x: 0.22, rz: 0.45 }),
    part(new THREE.BoxGeometry(0.6, 0.025, 0.12), '#6AA83C', { y: 0.85, x: -0.22, rz: -0.45, ry: 0.6 }),
    part(new THREE.BoxGeometry(0.5, 0.025, 0.1), '#78B544', { y: 1.15, x: 0.18, rz: 0.4, ry: -0.9 }),
    part(new THREE.CylinderGeometry(0.075, 0.06, 0.32, 6), '#F2C744', { y: 0.95, x: 0.09, rz: -0.35 }),
    part(new THREE.ConeGeometry(0.06, 0.25, 4), '#D9C27A', { y: 1.6 }),
  ]);
  const rice = mergeGeometries(
    [
      [0, 0, 0.55, 0],
      [0.09, 0.04, 0.48, 0.25],
      [-0.08, 0.05, 0.5, -0.25],
      [0.04, -0.09, 0.45, 0.2],
      [-0.05, -0.07, 0.42, -0.2],
    ].map(([x, z, h, r]) =>
      part(new THREE.ConeGeometry(0.035, h, 3), '#38A889', { x, z, y: h / 2, rz: r, rx: r * 0.5 })
    ).concat([part(new THREE.IcosahedronGeometry(0.06, 0), '#D8C878', { y: 0.5, x: 0.04 })])
  );
  const sunflower = mergeGeometries([
    part(new THREE.CylinderGeometry(0.03, 0.045, 1.2, 5), '#5E9E36', { y: 0.6 }),
    part(new THREE.BoxGeometry(0.34, 0.02, 0.16), '#6AA83C', { y: 0.55, x: 0.15, rz: 0.3 }),
    part(new THREE.BoxGeometry(0.3, 0.02, 0.14), '#6AA83C', { y: 0.8, x: -0.13, rz: -0.3 }),
    part(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 9), '#F7B731', { y: 1.25, z: 0.03, rx: Math.PI / 2.4 }),
    part(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8), '#6B3E1C', { y: 1.26, z: 0.06, rx: Math.PI / 2.4 }),
  ]);
  cropGeoCache = { wheat, corn, rice, sunflower };
  return cropGeoCache;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/* ---------- сахна ---------- */

export class FarmScene {
  constructor(container, { mode = 'hero', climate = 'normal', onHover } = {}) {
    this.container = container;
    this.mode = mode;
    this.onHover = onHover;
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
    this.tweens = [];
    this.plots = [];
    this.pickables = [];
    this.visible = true;
    this.mouse = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.tractorBoost = 1;
    this.env = { ...ENV[climate], sky: new THREE.Color(ENV[climate].sky) };
    this.climate = climate;

    this.initRenderer();
    this.initWorld();
    this.applyEnv(ENV[climate], ENV[climate], 1);

    if (mode === 'result') this.setAllocation(null);
    else this.setAllocation(this.defaultAllocation(), { animate: false });

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.tick());

    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { rootMargin: '120px' });
    this.io.observe(container);
  }

  initRenderer() {
    const { container } = this;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    if (this.mode === 'result') {
      const lr = new CSS2DRenderer();
      lr.setSize(w, h);
      lr.domElement.className = 'label-layer';
      container.appendChild(lr.domElement);
      this.labelRenderer = lr;
    }

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#D3ECF8', 45, 110);
    this.camera = new THREE.PerspectiveCamera(this.mode === 'result' ? 40 : 35, w / h, 0.1, 300);

    if (this.mode === 'result') {
      this.camera.position.set(0, 24, 25);
      const controls = new OrbitControls(this.camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 16;
      controls.maxDistance = 60;
      controls.maxPolarAngle = 1.25;
      controls.enablePan = false;
      this.controls = controls;
      this.raycaster = new THREE.Raycaster();
      renderer.domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
      renderer.domElement.addEventListener('pointerleave', () => this.setHovered(null));
    } else {
      window.addEventListener('pointermove', (e) => {
        this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      });
    }

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labelRenderer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  makeCropMaterial() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    const uniforms = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWind = uniforms.uWind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float h = max(position.y, 0.0);
          #ifdef USE_INSTANCING
            vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          #else
            vec2 ip = vec2(0.0);
          #endif
          float sw = sin(uTime * 1.7 + ip.x * 0.55 + ip.y * 0.35) * 0.07 * h * uWind;
          transformed.x += sw;
          transformed.z += sw * 0.45;`
        );
    };
    return mat;
  }

  initWorld() {
    const { scene } = this;
    const rnd = seeded(7);
    this.cropMat = this.makeCropMaterial();

    // Жарық
    this.hemi = new THREE.HemisphereLight('#EAF6FF', '#6B8F4E', 1);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#FFF2D8', 2.6);
    sun.position.set(22, 30, -14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -30;
    sc.right = 30;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 90;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    this.sun = sun;

    const sunBall = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.6, 1),
      new THREE.MeshBasicMaterial({ color: '#FFE27A', fog: false })
    );
    sunBall.position.set(44, 40, -60);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 32),
      new THREE.MeshBasicMaterial({ color: '#FFF1B8', transparent: true, opacity: 0.35, fog: false, depthWrite: false })
    );
    halo.position.copy(sunBall.position);
    halo.lookAt(0, 0, 0);
    scene.add(sunBall, halo);
    this.sunBall = sunBall;
    this.sunHalo = halo;

    // Жер беті — аралдық low-poly диск
    const groundGeo = new THREE.CylinderGeometry(42, 40, 2, 28, 1);
    this.groundMat = new THREE.MeshStandardMaterial({ color: '#8DC56C', flatShading: true, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Жол
    const roadMat = new THREE.MeshStandardMaterial({ color: '#CDB389', roughness: 1, flatShading: true });
    const road = new THREE.Mesh(new THREE.BoxGeometry(34, 0.08, 1.8), roadMat);
    road.position.set(0, 0.03, ROAD_Z);
    road.receiveShadow = true;
    const road2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 9), roadMat);
    road2.position.set(13.5, 0.03, ROAD_Z - 5);
    road2.receiveShadow = true;
    scene.add(road, road2);

    // Су: тоған + канал
    this.waterMat = new THREE.MeshStandardMaterial({
      color: '#4FB0E6', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true,
    });
    const bankMat = new THREE.MeshStandardMaterial({ color: '#A88B62', roughness: 1, flatShading: true });
    const pondBank = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.1, 0.3, 10), bankMat);
    pondBank.position.set(-15.5, 0.05, -6);
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.25, 10), this.waterMat);
    pond.position.set(-15.5, 0.12, -6);
    const canalBank = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 1.6), bankMat);
    canalBank.position.set(-0.5, 0.05, CANAL_Z);
    const canal = new THREE.Mesh(new THREE.BoxGeometry(23.6, 0.2, 1.0), this.waterMat);
    canal.position.set(-0.5, 0.1, CANAL_Z);
    [pondBank, canalBank].forEach((m) => (m.receiveShadow = true));
    scene.add(pondBank, pond, canalBank, canal);
    this.pond = pond;
    this.canal = canal;

    // Ферма үйі
    const house = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.1, 2.6),
      new THREE.MeshStandardMaterial({ color: '#F5ECDD', flatShading: true })
    );
    walls.position.y = 1.05;
    const roofGeo = new THREE.CylinderGeometry(1.75, 1.75, 3.8, 3);
    roofGeo.rotateZ(Math.PI / 2);
    roofGeo.rotateX(-Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#C2553C', flatShading: true }));
    roof.position.y = 2.1 + 0.875;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.06), new THREE.MeshStandardMaterial({ color: '#7A4E2D' }));
    door.position.set(0, 0.55, 1.32);
    const winMat = new THREE.MeshStandardMaterial({ color: '#9ED4F2', emissive: '#3A6F8F', emissiveIntensity: 0.2 });
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.06), winMat);
    w1.position.set(-1.0, 1.3, 1.32);
    const w2 = w1.clone();
    w2.position.x = 1.0;
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), new THREE.MeshStandardMaterial({ color: '#8E5A44' }));
    chimney.position.set(0.9, 3.1, -0.4);
    house.add(walls, roof, door, w1, w2, chimney);
    house.position.set(15.5, 0, -2.5);
    house.rotation.y = -Math.PI / 2.4;
    this.castAll(house);
    scene.add(house);

    // Силос
    const silo = new THREE.Group();
    const siloMat = new THREE.MeshStandardMaterial({ color: '#D9DEE3', metalness: 0.3, roughness: 0.5, flatShading: true });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 4.2, 10), siloMat);
    body.position.y = 2.1;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), siloMat);
    dome.position.y = 4.2;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#2F9E6E' }));
    ring.position.y = 3;
    silo.add(body, dome, ring);
    silo.position.set(16.5, 0, 2.6);
    this.castAll(silo);
    scene.add(silo);

    // Жел диірмені
    const mill = new THREE.Group();
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.55, 5.2, 6),
      new THREE.MeshStandardMaterial({ color: '#F4F1EA', flatShading: true })
    );
    tower.position.y = 2.6;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: '#E0503E' }));
    head.position.y = 5.3;
    const blades = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', flatShading: true });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.05), bladeMat);
      b.position.y = 1.2;
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI * 2) / 3;
      holder.add(b);
      blades.add(holder);
    }
    blades.position.set(0, 5.3, 0.5);
    mill.add(tower, head, blades);
    mill.position.set(-15, 0, 4.5);
    mill.rotation.y = 0.5;
    this.castAll(mill);
    scene.add(mill);
    this.blades = blades;

    // Шөп маялары
    const baleMat = new THREE.MeshStandardMaterial({ color: '#E2C26A', flatShading: true });
    [
      [12.2, 4.8],
      [13.2, 5.1],
      [12.7, 3.9],
    ].forEach(([x, z], i) => {
      const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 8), baleMat);
      bale.rotation.z = Math.PI / 2;
      bale.rotation.y = i * 0.6;
      bale.position.set(x, 0.45, z);
      bale.castShadow = true;
      scene.add(bale);
    });

    // Ағаштар
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#7A5434', flatShading: true });
    const leafMats = ['#4E9A47', '#5DAA4F', '#3F8A43'].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true })
    );
    this.leafMats = leafMats;
    const trees = new THREE.Group();
    let placed = 0;
    while (placed < 46) {
      const a = rnd() * Math.PI * 2;
      const r = 19 + rnd() * 18;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(z - ROAD_Z) < 2 && Math.abs(x) < 18) continue;
      if (Math.hypot(x + 15.5, z + 6) < 5) continue;
      const t = new THREE.Group();
      const s = 0.7 + rnd() * 0.7;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 5), trunkMat);
      trunk.position.y = 0.5;
      t.add(trunk);
      if (rnd() > 0.45) {
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 6), leafMats[placed % 3]);
        c1.position.y = 1.6;
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.3, 6), leafMats[(placed + 1) % 3]);
        c2.position.y = 2.4;
        t.add(c1, c2);
      } else {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), leafMats[placed % 3]);
        c.position.y = 1.7;
        t.add(c);
      }
      t.scale.setScalar(s);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * 6;
      t.userData.phase = rnd() * 6;
      this.castAll(t);
      trees.add(t);
      placed++;
    }
    scene.add(trees);
    this.trees = trees;

    // Бұлттар
    this.clouds = [];
    this.cloudMats = [];
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', flatShading: true, transparent: true, opacity: 1, fog: false });
      const g = new THREE.Group();
      const parts = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < parts; j++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rnd() * 1.2, 0), mat);
        m.position.set(j * 1.4 - parts * 0.7, rnd() * 0.6, rnd() * 1.2 - 0.6);
        m.scale.y = 0.7;
        g.add(m);
      }
      g.position.set(-40 + ((i * 37) % 80), 13 + rnd() * 5, -26 + rnd() * 36);
      g.userData.speed = 0.5 + rnd() * 0.8;
      g.userData.mat = mat;
      g.castShadow = false;
      scene.add(g);
      this.clouds.push(g);
      this.cloudMats.push(mat);
    }

    // Жаңбыр
    const N = 2600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * 70;
      pos[i * 3 + 1] = rnd() * 20;
      pos[i * 3 + 2] = (rnd() - 0.5) * 60;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.PointsMaterial({ color: '#8FC3E6', size: 0.13, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.Points(rainGeo, this.rainMat);
    this.rain.visible = false;
    scene.add(this.rain);

    // Трактор
    this.tractor = this.buildTractor();
    this.tractor.position.set(-10, 0, ROAD_Z);
    this.tractor.userData = { dir: 1, x: -10 };
    scene.add(this.tractor);

    this.fieldGroup = new THREE.Group();
    scene.add(this.fieldGroup);
  }

  castAll(obj) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  buildTractor() {
    const t = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: '#E04A3A', flatShading: true, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2B2F33', flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: '#A8D8F0', roughness: 0.1, metalness: 0.2 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.8), red);
    hood.position.set(0.45, 0.7, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.85), red);
    cab.position.set(-0.45, 1.1, 0);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.45, 0.7), glass);
    win.position.set(-0.45, 1.25, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), dark);
    roof.position.set(-0.45, 1.56, 0);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), dark);
    pipe.position.set(0.8, 1.2, 0.2);
    t.add(hood, cab, win, roof, pipe);
    this.wheels = [];
    const mk = (r, w, x, z) => {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 10), dark);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(x, r, z);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.02, 8), new THREE.MeshStandardMaterial({ color: '#F2C744' }));
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wh.position);
      t.add(wh, hub);
      this.wheels.push(wh, hub);
    };
    mk(0.48, 0.32, -0.45, 0.55);
    mk(0.48, 0.32, -0.45, -0.55);
    mk(0.28, 0.22, 0.75, 0.48);
    mk(0.28, 0.22, 0.75, -0.48);
    this.castAll(t);
    t.scale.setScalar(1.15);
    return t;
  }

  /* ---------- егістік телімдері ---------- */

  defaultAllocation() {
    return CROPS.map((c) => ({ id: c.id, name: c.name, ha: 25 }));
  }

  buildPlot({ x, z, w, d, crop, info, index }) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const soilColor = new THREE.Color(this.env.soil);
    const soilMat = new THREE.MeshStandardMaterial({ color: soilColor, flatShading: true, roughness: 1 });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, w - 0.3), 0.36, d - 0.3), soilMat);
    soil.position.y = 0.18;
    soil.receiveShadow = true;
    soil.castShadow = true;
    g.add(soil);

    const tint = crop ? new THREE.Color(crop.id === 'rice' ? '#7CCFD8' : crop.color).lerp(new THREE.Color('#ffffff'), crop.id === 'rice' ? 0.1 : 0.25) : new THREE.Color('#A98157');
    const topMat = new THREE.MeshStandardMaterial({
      color: soilColor.clone(),
      flatShading: true,
      roughness: crop?.id === 'rice' ? 0.25 : 0.95,
      emissive: '#000000',
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.15, w - 0.45), 0.05, d - 0.45), topMat);
    top.position.y = 0.38;
    top.receiveShadow = true;
    g.add(top);

    // Жыралар (сызықтар)
    if (!crop) {
      const furrowMat = new THREE.MeshStandardMaterial({ color: '#7C5A3A', flatShading: true });
      for (let fz = -d / 2 + 0.8; fz < d / 2 - 0.5; fz += 0.7) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.1, w - 0.7), 0.06, 0.12), furrowMat);
        f.position.set(0, 0.42, fz);
        g.add(f);
      }
    }

    const cropsGroup = new THREE.Group();
    cropsGroup.position.y = 0.4;
    if (crop) {
      const geo = cropGeometries()[crop.id];
      const sp = crop.id === 'corn' || crop.id === 'sunflower' ? 0.62 : 0.5;
      const nx = Math.max(1, Math.floor((w - 0.6) / sp));
      const nz = Math.max(1, Math.floor((d - 0.6) / sp));
      const inst = new THREE.InstancedMesh(geo, this.cropMat, nx * nz);
      const rnd = seeded(index * 101 + nx * 7 + nz);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      let k = 0;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          p.set(
            -((nx - 1) * sp) / 2 + i * sp + (rnd() - 0.5) * 0.12,
            0,
            -((nz - 1) * sp) / 2 + j * sp + (rnd() - 0.5) * 0.12
          );
          q.setFromAxisAngle(up, crop.id === 'sunflower' ? (rnd() - 0.5) * 0.6 : rnd() * Math.PI * 2);
          const sc = 0.85 + rnd() * 0.3;
          s.set(sc, sc * (0.9 + rnd() * 0.2), sc);
          m.compose(p, q, s);
          inst.setMatrixAt(k++, m);
        }
      }
      inst.castShadow = true;
      inst.receiveShadow = true;
      cropsGroup.add(inst);
      inst.userData.plotIndex = index;
      this.pickables.push(inst);
    }
    g.add(cropsGroup);
    soil.userData.plotIndex = index;
    top.userData.plotIndex = index;
    this.pickables.push(soil, top);

    let label = null;
    if (this.labelRenderer && info) {
      const el = document.createElement('div');
      el.className = 'plot-label' + (crop ? '' : ' plot-label--fallow');
      el.innerHTML = `<b>${info.name}</b><span>${info.ha.toFixed(1)} га</span>`;
      if (crop) el.style.setProperty('--c', crop.color);
      label = new CSS2DObject(el);
      label.position.set(0, crop ? 2.4 : 1.2, 0);
      g.add(label);
    }

    return { group: g, soilMat, topMat, tint, cropsGroup, info, crop, label, w, d };
  }

  clearPlots() {
    this.plots.forEach((p) => {
      p.group.traverse((o) => {
        if (o.isMesh && !o.isInstancedMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
        if (o.isInstancedMesh) o.dispose();
        if (o.isCSS2DObject) o.element.remove();
      });
      this.fieldGroup.remove(p.group);
    });
    this.plots = [];
    this.pickables = [];
    this.hovered = null;
  }

  /**
   * allocations: [{id, name, ha, ...info}], land — жалпы жер.
   * hero/preview режимінде 2×2 тор, result режимінде гектарға пропорционал жолақтар.
   */
  setAllocation(allocations, { land = 100, animate = true } = {}) {
    this.clearPlots();
    if (!allocations) return;
    const specs = [];
    if (this.mode !== 'result') {
      const w = FIELD_W / 2;
      const d = FIELD_D / 2;
      allocations.slice(0, 4).forEach((a, i) => {
        specs.push({
          x: (i % 2 === 0 ? -1 : 1) * (w / 2 + 0.15),
          z: (i < 2 ? -1 : 1) * (d / 2 + 0.15),
          w,
          d,
          crop: CROP_BY_ID[a.id],
          info: a,
        });
      });
    } else {
      const items = allocations.filter((a) => a.ha > 0.05).map((a) => ({ ...a, crop: CROP_BY_ID[a.id] }));
      const used = items.reduce((s, a) => s + a.ha, 0);
      const fallow = land - used;
      if (fallow > 0.3) items.push({ id: 'fallow', name: 'Бос жер', ha: fallow, crop: null });
      const total = items.reduce((s, a) => s + a.ha, 0) || 1;
      let widths = items.map((a) => Math.max(1.1, (a.ha / total) * FIELD_W));
      const k = FIELD_W / widths.reduce((s, v) => s + v, 0);
      widths = widths.map((v) => v * k);
      let cursor = -FIELD_W / 2;
      items.forEach((a, i) => {
        specs.push({ x: cursor + widths[i] / 2, z: 0, w: widths[i], d: FIELD_D, crop: a.crop, info: a });
        cursor += widths[i];
      });
    }

    specs.forEach((s, index) => {
      const plot = this.buildPlot({ ...s, index });
      this.plots.push(plot);
      this.fieldGroup.add(plot.group);
      const delay = animate ? 0.15 + index * 0.28 : 0;
      if (animate) {
        plot.cropsGroup.scale.set(1, 0.001, 1);
        plot.group.position.y = -0.4;
        if (plot.label) plot.label.element.style.opacity = '0';
        const from = plot.topMat.color.clone();
        this.tween(0.9, (k) => {
          plot.group.position.y = -0.4 + 0.4 * easeOutCubic(k);
          plot.topMat.color.copy(from).lerp(plot.tint, easeInOut(k));
        }, delay);
        this.tween(1.1, (k) => {
          plot.cropsGroup.scale.y = Math.max(0.001, easeOutBack(k));
          if (plot.label) {
            plot.label.element.style.opacity = String(k);
          }
        }, delay + 0.35);
      } else {
        plot.topMat.color.copy(plot.tint);
      }
    });
  }

  /* ---------- климат ---------- */

  setClimate(id, { duration = 1.4 } = {}) {
    if (!ENV[id]) return;
    const from = this.snapshotEnv();
    const to = ENV[id];
    this.climate = id;
    this.tween(duration, (k) => this.applyEnv(from, to, easeInOut(k)));
  }

  snapshotEnv() {
    const e = this.env;
    return { ...e, sky: '#' + e.sky.getHexString() };
  }

  applyEnv(from, to, k) {
    const lerpC = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    const lerp = (a, b) => a + (b - a) * k;
    const sky = lerpC(from.sky, to.sky);
    this.scene.background = sky;
    this.scene.fog.color.copy(lerpC(from.fog, to.fog));
    this.groundMat.color.copy(lerpC(from.ground, to.ground));
    this.sun.intensity = lerp(from.sun, to.sun);
    this.sun.color.copy(lerpC(from.sunColor, to.sunColor));
    this.hemi.intensity = lerp(from.hemi, to.hemi);
    const cloudAmt = lerp(from.clouds, to.clouds);
    const cloudCol = lerpC(from.cloudColor, to.cloudColor);
    this.cloudMats.forEach((m, i) => {
      m.opacity = THREE.MathUtils.clamp(cloudAmt - i, 0, 1);
      m.color.copy(cloudCol);
      this.clouds[i].visible = m.opacity > 0.01;
    });
    const rain = lerp(from.rain, to.rain);
    this.rainMat.opacity = rain * 0.75;
    this.rain.visible = rain > 0.01;
    const water = lerp(from.water, to.water);
    this.pond.scale.set(0.55 + 0.45 * Math.min(1.15, water), 1, 0.55 + 0.45 * Math.min(1.15, water));
    this.canal.scale.set(1, 1, Math.max(0.3, Math.min(1.25, water)));
    this.waterMat.color.copy(lerpC(from.water < 0.7 ? '#7DB6C9' : '#4FB0E6', to.water < 0.7 ? '#7DB6C9' : '#4FB0E6'));
    const wind = lerp(from.wind, to.wind);
    this.uniforms.uWind.value = wind;
    const sunScale = lerp(from.sunScale, to.sunScale);
    this.sunBall.scale.setScalar(sunScale);
    this.sunHalo.scale.setScalar(sunScale);
    this.sunHalo.material.opacity = 0.25 + 0.25 * (sunScale - 0.8);
    const soil = lerpC(from.soil, to.soil);
    this.plots.forEach((p) => p.soilMat.color.copy(soil));
    this.leafMats.forEach((m, i) => {
      const base = ['#4E9A47', '#5DAA4F', '#3F8A43'][i];
      const dryTint = new THREE.Color(base).lerp(new THREE.Color('#A8A04A'), 0.45);
      const rainTint = new THREE.Color(base).lerp(new THREE.Color('#2F8A3E'), 0.4);
      const tgt = (e) => (e.rain ? rainTint : e.water < 0.7 ? dryTint : new THREE.Color(base));
      m.color.copy(tgt(from).clone().lerp(tgt(to), k));
    });
    this.env = {
      sky, fog: '#' + this.scene.fog.color.getHexString(), ground: '#' + this.groundMat.color.getHexString(),
      soil: '#' + soil.getHexString(), sun: this.sun.intensity, sunColor: '#' + this.sun.color.getHexString(),
      hemi: this.hemi.intensity, clouds: cloudAmt, cloudColor: '#' + cloudCol.getHexString(), rain, water, wind, sunScale,
    };
  }

  /* ---------- интерактив ---------- */

  onPointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    const idx = hit ? hit.object.userData.plotIndex : null;
    this.setHovered(idx ?? null, e);
  }

  setHovered(idx, e) {
    if (this.hovered !== idx) {
      this.plots.forEach((p, i) => {
        p.topMat.emissive.set(i === idx ? '#3a3a2a' : '#000000');
        p.label?.element.classList.toggle('is-active', i === idx);
      });
      this.hovered = idx;
      this.renderer.domElement.style.cursor = idx != null ? 'pointer' : 'grab';
    }
    this.onHover?.(idx != null ? this.plots[idx].info : null, e);
  }

  setBusy(busy) {
    this.tractorBoost = busy ? 4 : 1;
  }

  tween(duration, fn, delay = 0) {
    this.tweens.push({ start: performance.now() + delay * 1000, duration: duration * 1000, fn });
  }

  /* ---------- анимация циклы ---------- */

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const now = performance.now();
    this.tweens = this.tweens.filter((tw) => {
      if (now < tw.start) return true;
      const k = Math.min(1, (now - tw.start) / tw.duration);
      tw.fn(k);
      return k < 1;
    });
    if (!this.visible || document.hidden) return;

    this.uniforms.uTime.value = t;
    const wind = this.uniforms.uWind.value;

    // Камера
    if (this.controls) {
      this.controls.update();
    } else {
      this.parallax.lerp(this.mouse, 0.04);
      const az = Math.PI / 4 + Math.sin(t * 0.08) * 0.22 + this.parallax.x * 0.12;
      const r = this.mode === 'hero' ? 40 : 38;
      const y = (this.mode === 'hero' ? 22 : 20) + this.parallax.y * 2.5;
      this.camera.position.set(Math.sin(az) * r, y, Math.cos(az) * r);
      this.camera.lookAt(this.mode === 'hero' ? 1.5 : 0, 0, 0);
    }

    // Трактор
    const tr = this.tractor;
    const ud = tr.userData;
    ud.x += ud.dir * dt * 2.2 * this.tractorBoost;
    if (ud.x > 11) ud.dir = -1;
    if (ud.x < -12) ud.dir = 1;
    tr.position.x = ud.x;
    tr.position.y = Math.abs(Math.sin(t * 9)) * 0.03;
    const targetRot = ud.dir > 0 ? 0 : Math.PI;
    tr.rotation.y += (targetRot - tr.rotation.y) * Math.min(1, dt * 3);
    this.wheels.forEach((w) => (w.rotation.y -= dt * 4 * this.tractorBoost));

    // Диірмен, бұлттар, ағаштар
    this.blades.rotation.z -= dt * 1.2 * wind;
    this.clouds.forEach((c) => {
      if (!c.visible) return;
      c.position.x += dt * c.userData.speed * (0.6 + wind * 0.5);
      if (c.position.x > 42) c.position.x = -42;
    });
    this.trees.children.forEach((tree) => {
      tree.rotation.z = Math.sin(t * 1.3 + tree.userData.phase) * 0.025 * wind;
    });

    // Жаңбыр
    if (this.rain.visible) {
      const arr = this.rain.geometry.attributes.position.array;
      for (let i = 1; i < arr.length; i += 3) {
        arr[i] -= dt * 22;
        if (arr[i] < 0) arr[i] += 20;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer?.render(this.scene, this.camera);
  }
}
