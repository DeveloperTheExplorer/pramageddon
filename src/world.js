import * as THREE from 'three';
import {
  box,
  rounded,
  cyl,
  sphere,
  cone,
  mat,
  glowMat,
  tubeBetween,
  addOutline,
  createPram,
  createCrib,
  createFox,
  createItem,
  makeIconSprite,
  makeSign,
  makeNameTag,
  createSnowman,
  createPine,
  createBirch,
} from './models.js';
import { PRAM_LAYOUTS, PRAM_COLORS, STATIONS, BABY_NAMES } from './config.js';

function addCircleShadow(parent, radius, opacity = 0.18) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 18),
    new THREE.MeshBasicMaterial({ color: '#161124', transparent: true, opacity, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  parent.add(mesh);
  return mesh;
}

function makeHighlight(radius = 0.95) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 30),
    new THREE.MeshBasicMaterial({
      color: '#ffd166',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.76, 24),
    new THREE.MeshBasicMaterial({
      color: '#ffd166',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.024;
  group.add(ring, inner);
  group.visible = false;
  return { group, ring, inner };
}

function addWindow(parent, x, y, z, w = 1.15, h = 1.25, opts = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const frame = box(w + 0.2, h + 0.2, 0.16, '#f2dfba');
  frame.position.z = 0;
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    glowMat(opts.color || '#ffc86e', opts.glow === undefined ? 0.25 : opts.glow)
  );
  pane.position.z = 0.1;
  const mullionV = box(0.07, h, 0.03, '#6f4835');
  mullionV.position.z = 0.13;
  const mullionH = box(w, 0.07, 0.03, '#6f4835');
  mullionH.position.z = 0.13;
  const sill = box(w + 0.34, 0.12, 0.32, '#a7704e');
  sill.position.set(0, -h / 2 - 0.08, 0.1);
  g.add(frame, pane, mullionV, mullionH, sill);
  if (opts.curtains !== false) {
    const curtainL = rounded(0.26, h + 0.42, 0.08, opts.curtainColor || '#cc6b54', 0.04);
    curtainL.position.set(-w / 2 - 0.09, 0, 0.17);
    const curtainR = curtainL.clone();
    curtainR.position.x = w / 2 + 0.09;
    g.add(curtainL, curtainR);
  }
  parent.add(g);
  return g;
}

function makeStringLights(points, color = '#ffd166', bulbRadius = 0.055) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points);
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, 0.012, 4, false),
    new THREE.MeshBasicMaterial({ color: '#5d4a43' })
  );
  group.add(wire);
  const bulbs = [];
  const count = 14;
  for (let i = 1; i < count; i += 1) {
    const p = curve.getPoint(i / count);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(bulbRadius, 5, 4), glowMat(color, 1.2));
    bulb.position.copy(p);
    bulb.position.y -= 0.07;
    bulbs.push(bulb);
    group.add(bulb);
  }
  group.userData = { bulbs, phase: Math.random() * 10 };
  return group;
}

function makeLampPost(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const base = cyl(0.2, 0.29, 0.3, 8, '#29314f');
  base.position.y = 0.15;
  const pole = cyl(0.075, 0.095, 3.4, 7, '#29314f');
  pole.position.y = 1.7;
  const arm = tubeBetween([0, 3.35, 0], [0.52, 3.35, 0], 0.045, '#29314f', 5);
  const cage = box(0.34, 0.44, 0.34, '#29314f');
  cage.position.set(0.6, 3.1, 0);
  const glass = box(0.25, 0.32, 0.25, '#ffd278', { material: glowMat('#ffca6e', 0.45) });
  glass.position.set(0.6, 3.12, 0);
  const cap = cone(0.25, 0.2, 4, '#29314f');
  cap.position.set(0.6, 3.42, 0);
  const light = new THREE.PointLight('#ffb45e', 3.4, 7.5, 2);
  light.position.set(0.6, 3.0, 0);
  const snow = sphere(0.24, '#f4f8fb', { widthSeg: 6, heightSeg: 4 });
  snow.position.set(0.6, 3.54, 0);
  snow.scale.y = 0.45;
  g.add(base, pole, arm, cage, glass, cap, snow, light);
  return g;
}

function makePaciBasket() {
  const g = new THREE.Group();
  const table = rounded(1.65, 0.18, 1.15, '#a9714d', 0.05);
  table.position.y = 0.78;
  const legs = [];
  for (const x of [-0.64, 0.64]) {
    for (const z of [-0.4, 0.4]) {
      const leg = box(0.12, 0.76, 0.12, '#85583f');
      leg.position.set(x, 0.38, z);
      legs.push(leg);
    }
  }
  const basket = cyl(0.46, 0.34, 0.36, 9, '#d7a35f');
  basket.position.y = 1.02;
  const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 5, 12), mat('#b8814b'));
  basketRim.rotation.x = Math.PI / 2;
  basketRim.position.y = 1.2;
  const cushion = cyl(0.38, 0.38, 0.07, 10, '#ff9ec7');
  cushion.position.y = 1.19;
  for (let i = 0; i < 5; i += 1) {
    const paci = createItem('pacifier');
    paci.scale.setScalar(0.7);
    paci.position.set(-0.22 + (i % 3) * 0.22, 1.26 + Math.floor(i / 3) * 0.07, (i % 2 ? 0.08 : -0.1));
    paci.rotation.y = Math.random() * 2;
    g.add(paci);
  }
  const sign = makeSign('SMOKKER', '#f7d8a6');
  sign.scale.set(0.8, 0.8, 0.8);
  sign.position.set(0, 0.34, 0.61);
  sign.rotation.x = -0.18;
  g.add(table, basket, basketRim, cushion, sign, ...legs);
  return g;
}

function makeBlanketPile() {
  const g = new THREE.Group();
  const bench = rounded(1.65, 0.22, 1.0, '#9b6848', 0.06);
  bench.position.y = 0.52;
  for (const x of [-0.63, 0.63]) {
    const leg = box(0.14, 0.56, 0.82, '#7d523c');
    leg.position.set(x, 0.28, 0);
    g.add(leg);
  }
  const palette = ['#8ecae6', '#ff9ec7', '#ffd166', '#b8f2e6', '#b3a4ff'];
  for (let i = 0; i < 6; i += 1) {
    const blanket = rounded(0.95 - i * 0.05, 0.1, 0.66 - i * 0.03, palette[i % palette.length], 0.035);
    blanket.position.set(i % 2 ? -0.04 : 0.04, 0.67 + i * 0.1, 0);
    blanket.rotation.y = (i % 2 ? 1 : -1) * 0.04;
    g.add(blanket);
  }
  const sign = makeSign('TEPPER', '#f7d8a6');
  sign.scale.set(0.8, 0.8, 0.8);
  sign.position.set(0, 0.18, 0.56);
  sign.rotation.x = -0.18;
  g.add(bench, sign);
  return g;
}

function makeBottleCrate() {
  const g = new THREE.Group();
  const crate = box(1.2, 0.72, 0.95, '#94623f');
  crate.position.y = 0.38;
  const lip = box(1.28, 0.1, 1.02, '#b07a50');
  lip.position.y = 0.72;
  for (const x of [-0.5, 0.5]) {
    const bracket = box(0.08, 0.78, 1.0, '#6e472f');
    bracket.position.set(x, 0.39, 0);
    g.add(bracket);
  }
  for (let i = 0; i < 6; i += 1) {
    const bottle = createItem('bottle');
    bottle.scale.setScalar(0.75);
    bottle.position.set(-0.4 + (i % 3) * 0.4, 0.86, -0.25 + Math.floor(i / 3) * 0.48);
    g.add(bottle);
  }
  const sign = makeSign('FLASKER', '#f7d8a6');
  sign.scale.set(0.7, 0.7, 0.7);
  sign.position.set(0, 0.26, 0.52);
  sign.rotation.x = -0.18;
  g.add(crate, lip, sign);
  return g;
}

function makeWarmer() {
  const g = new THREE.Group();
  const cabinet = rounded(1.65, 0.82, 1.0, '#4c6781', 0.08);
  cabinet.position.y = 0.46;
  const top = rounded(1.78, 0.14, 1.12, '#d9c7a4', 0.05);
  top.position.y = 0.92;
  const pot = cyl(0.42, 0.38, 0.3, 10, '#b8c3d1');
  pot.position.y = 1.1;
  const water = cyl(0.36, 0.36, 0.05, 10, '#7ee0c3');
  water.position.y = 1.25;
  const burner = new THREE.Mesh(new THREE.CircleGeometry(0.36, 12), glowMat('#ff7d4e', 1.6));
  burner.rotation.x = -Math.PI / 2;
  burner.position.y = 1.28;
  const knob1 = cyl(0.08, 0.08, 0.06, 7, '#ffd166');
  knob1.rotation.x = Math.PI / 2;
  knob1.position.set(-0.48, 0.65, 0.52);
  const knob2 = knob1.clone();
  knob2.position.x = 0.48;
  const light = new THREE.PointLight('#ff8d55', 4.2, 5.2, 2);
  light.position.set(0, 1.5, 0.2);
  const sign = makeSign('VARMER', '#f4c97d');
  sign.scale.set(0.65, 0.65, 0.65);
  sign.position.set(0, 0.45, 0.56);
  const bottle = createItem('bottle');
  bottle.scale.setScalar(0.9);
  bottle.position.set(0, 1.42, 0.04);
  bottle.visible = false;
  const steamGroup = new THREE.Group();
  steamGroup.position.set(0, 1.45, 0);
  steamGroup.visible = false;
  const puffs = [];
  for (let i = 0; i < 4; i += 1) {
    const puff = sphere(0.09 + i * 0.015, '#eef7f5', {
      widthSeg: 5,
      heightSeg: 4,
      matOptions: { transparent: true, opacity: 0.32 - i * 0.04, depthWrite: false },
    });
    puff.position.set(i % 2 ? 0.1 : -0.08, i * 0.14, 0);
    puffs.push(puff);
    steamGroup.add(puff);
  }
  g.add(cabinet, top, pot, water, burner, knob1, knob2, light, sign, bottle, steamGroup);
  g.userData = { bottle, steamGroup, puffs, burner, light };
  return g;
}

function makeTeddyChest() {
  const g = new THREE.Group();
  const chest = rounded(1.25, 0.66, 0.9, '#8f5a3b', 0.06);
  chest.position.y = 0.36;
  const lid = rounded(1.3, 0.2, 0.94, '#a66d48', 0.06);
  lid.position.set(0, 0.78, -0.26);
  lid.rotation.x = -0.72;
  const trim = box(1.32, 0.09, 0.96, '#e0bb7b');
  trim.position.y = 0.06;
  const lock = box(0.18, 0.22, 0.06, '#ffd166');
  lock.position.set(0, 0.58, 0.47);
  for (let i = 0; i < 2; i += 1) {
    const teddy = createItem('teddy');
    teddy.scale.setScalar(0.95);
    teddy.position.set(-0.28 + i * 0.55, 0.74 + i * 0.05, 0.06);
    teddy.rotation.y = -0.4 + i * 0.8;
    g.add(teddy);
  }
  const sign = makeSign('BAMSE', '#f7d8a6');
  sign.scale.set(0.7, 0.7, 0.7);
  sign.position.set(0, 0.3, 0.51);
  g.add(chest, lid, trim, lock, sign);
  return g;
}

function makeRug(w, d, color = '#d7a07b') {
  const rug = rounded(w, 0.04, d, color, 0.08);
  rug.position.y = 0.055;
  rug.castShadow = false;
  const border = rounded(w - 0.18, 0.05, d - 0.18, '#f0cba7', 0.06);
  border.position.y = 0.075;
  border.castShadow = false;
  const inner = rounded(w - 0.42, 0.052, d - 0.42, color, 0.05);
  inner.position.y = 0.082;
  inner.castShadow = false;
  const g = new THREE.Group();
  g.add(rug, border, inner);
  return g;
}

function makeCat() {
  const g = new THREE.Group();
  const body = sphere(0.26, '#d5a36d', { widthSeg: 7, heightSeg: 5 });
  body.scale.set(1.55, 0.72, 1.0);
  body.position.y = 0.2;
  const head = sphere(0.17, '#d5a36d', { widthSeg: 7, heightSeg: 5 });
  head.position.set(0.38, 0.24, 0.02);
  for (const x of [0.29, 0.47]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), mat('#b98557'));
    ear.position.set(x, 0.37, 0.02);
    g.add(ear);
  }
  const tail = tubeBetween([-0.33, 0.2, 0], [-0.62, 0.12, 0.18], 0.04, '#d5a36d', 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#3b2d3d' });
  for (const z of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 3), eyeMat);
    eye.position.set(0.47, 0.27, z);
    g.add(eye);
  }
  g.add(body, head, tail);
  g.userData = { tail };
  return g;
}

function createNorwegianFlag() {
  const group = new THREE.Group();
  const pole = cyl(0.055, 0.075, 4.9, 7, '#d9ddd8');
  pole.position.y = 2.45;
  const knob = sphere(0.11, '#f1d38a', { widthSeg: 6, heightSeg: 4 });
  knob.position.y = 4.96;
  const base = cyl(0.22, 0.3, 0.22, 8, '#8796a8');
  base.position.y = 0.11;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 168;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ba0c2f';
  ctx.fillRect(0, 0, 256, 168);
  ctx.fillStyle = '#f7f4ea';
  ctx.fillRect(64, 0, 48, 168);
  ctx.fillRect(0, 64, 256, 40);
  ctx.fillStyle = '#00205b';
  ctx.fillRect(80, 0, 26, 168);
  ctx.fillRect(0, 76, 256, 20);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 1.35, 12, 1),
    new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.95 })
  );
  flag.position.set(1.05, 4.18, 0);
  flag.castShadow = true;
  const finial = sphere(0.05, '#ffd166', { widthSeg: 5, heightSeg: 4 });
  finial.position.set(2.08, 4.18, 0);
  const flagGroup = new THREE.Group();
  flagGroup.add(flag, finial);
  group.add(pole, knob, base, flagGroup);
  group.position.set(-9.55, 0, 1.15);
  group.userData = { flagGroup, flag, texture };
  return group;
}

export function createWorld(scene, options = {}) {
  const world = {
    colliders: [],
    prams: [],
    stations: {},
    animated: {},
    bounds: { minX: -10.7, maxX: 10.7, minZ: -9.0, maxZ: 9.8 },
  };

  scene.background = new THREE.Color('#bcd6e7');
  scene.fog = new THREE.FogExp2('#cddae2', 0.012);

  const hemi = new THREE.HemisphereLight('#dceeff', '#8b7c86', 1.3);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffe8cf', 0.24);
  scene.add(ambient);
  const sunLight = new THREE.DirectionalLight('#ffe3b4', 2.75);
  sunLight.position.set(-10.5, 16, 9.5);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(options.mobile ? 1024 : 2048, options.mobile ? 1024 : 2048);
  sunLight.shadow.camera.left = -16;
  sunLight.shadow.camera.right = 16;
  sunLight.shadow.camera.top = 16;
  sunLight.shadow.camera.bottom = -16;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 48;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight, sunLight.target);
  world.sunLight = sunLight;
  world.hemisphere = hemi;
  world.ambient = ambient;

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(75, 32, 18);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#6ea4cf') },
      midColor: { value: new THREE.Color('#d5e5ee') },
      bottomColor: { value: new THREE.Color('#ffe5c5') },
      offset: { value: 9 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        vec3 c = mix(bottomColor, midColor, smoothstep(0.0, 0.28, h));
        c = mix(c, topColor, smoothstep(0.16, 0.82, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  world.animated.sky = sky;

  // Stars
  const starCount = 650;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const c = new THREE.Color();
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.15 + Math.random() * 0.82);
    const r = 55 + Math.random() * 14;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPos[i * 3 + 1] = Math.cos(phi) * r * 0.75 + 8;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r - 8;
    c.setHSL(0.52 + Math.random() * 0.18, 0.35, 0.7 + Math.random() * 0.3);
    starColors[i * 3] = c.r;
    starColors[i * 3 + 1] = c.g;
    starColors[i * 3 + 2] = c.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.visible = false;
  scene.add(stars);

  // A low winter sun and its warm halo.
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1c8' }));
  sun.position.set(-13.5, 13.5, -26);
  scene.add(sun);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hctx = haloCanvas.getContext('2d');
  const grad = hctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,247,214,0.62)');
  grad.addColorStop(0.4, 'rgba(255,210,140,0.22)');
  grad.addColorStop(1, 'rgba(255,180,110,0)');
  hctx.fillStyle = grad;
  hctx.fillRect(0, 0, 128, 128);
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: haloTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  halo.position.copy(sun.position);
  halo.scale.set(19, 19, 1);
  scene.add(halo);
  world.animated.sun = sun;
  world.animated.halo = halo;

  // Soft low-sun ribbons / dusk haze
  const auroraColors = ['#ffd4a8', '#ffb9a3', '#d9c6ff'];
  const auroras = [];
  for (let i = 0; i < 3; i += 1) {
    const geo = new THREE.PlaneGeometry(48 + i * 7, 7 + i * 1.4, 48, 1);
    const shader = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(auroraColors[i]) },
        uOpacity: { value: 0.22 - i * 0.03 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.y += sin(p.x * 0.22 + uTime * 0.35 + ${i.toFixed(1)}) * 1.2;
          p.z += sin(p.x * 0.13 + uTime * 0.2) * 1.4;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float band = sin(vUv.x * 13.0 + uTime * 0.4 + sin(vUv.x * 5.0) * 2.0) * 0.5 + 0.5;
          float edge = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
          float alpha = edge * (0.25 + band * 0.55) * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    const ribbon = new THREE.Mesh(geo, shader);
    ribbon.position.set(0, 15 + i * 2.5, -30 - i * 3);
    ribbon.rotation.z = -0.08 + i * 0.04;
    auroras.push(ribbon);
    scene.add(ribbon);
  }
  world.animated.auroras = auroras;

  // Distant mountains
  const mountains = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const radius = 5 + Math.random() * 3;
    const height = 8 + Math.random() * 6;
    const m = cone(radius, height, 4, i % 2 ? '#6f89a4' : '#7f9bb5');
    m.position.set(-28 + i * 9, 2.5, -38 - Math.random() * 8);
    m.rotation.y = Math.random() * Math.PI;
    const cap = cone(radius * 0.42, height * 0.25, 4, '#edf4f8');
    cap.position.set(m.position.x, m.position.y + height * 0.38, m.position.z);
    cap.rotation.y = m.rotation.y;
    mountains.add(m, cap);
  }
  scene.add(mountains);

  // Ground
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 80),
    new THREE.MeshStandardMaterial({ color: '#aebfc7', roughness: 1 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.12;
  outerGround.receiveShadow = true;
  scene.add(outerGround);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(23.2, 21.8),
    new THREE.MeshStandardMaterial({ color: '#c9d7e4', roughness: 0.98 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0.2);
  ground.receiveShadow = true;
  scene.add(ground);

  // Snow patches on the ground
  const patchMat = new THREE.MeshStandardMaterial({ color: '#e9f1f7', roughness: 1, flatShading: true });
  for (let i = 0; i < 28; i += 1) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 1.4, 7), patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = Math.random() * Math.PI;
    patch.position.set((Math.random() - 0.5) * 20, 0.017, -0.1 + Math.random() * 9.4);
    patch.scale.y = 0.5 + Math.random() * 0.7;
    patch.receiveShadow = true;
    scene.add(patch);
  }

  // Path from door to the pram lawn
  const pathMat = new THREE.MeshStandardMaterial({ color: '#8d8f9f', roughness: 1, flatShading: true });
  for (let i = 0; i < 7; i += 1) {
    const slab = new THREE.Mesh(new THREE.CircleGeometry(0.48 + (i % 2) * 0.12, 6), pathMat);
    slab.rotation.x = -Math.PI / 2;
    slab.rotation.z = Math.random() * Math.PI;
    slab.position.set(i % 2 ? 0.23 : -0.22, 0.02, 0.9 + i * 1.15);
    slab.scale.set(1.2, 0.8, 1);
    slab.receiveShadow = true;
    scene.add(slab);
  }

  // -------- HOUSE --------
  const house = new THREE.Group();
  scene.add(house);
  world.house = house;

  const floor = rounded(12.3, 0.18, 8.6, '#9b6a48', 0.08);
  floor.position.set(0, 0.02, -5.35);
  floor.receiveShadow = true;
  house.add(floor);
  for (let i = 0; i < 9; i += 1) {
    const plank = box(0.035, 0.015, 8.35, '#7c5038');
    plank.position.set(-5.6 + i * 1.4, 0.125, -5.35);
    plank.castShadow = false;
    house.add(plank);
  }

  const wallColor = '#a94f3f';
  const wallDark = '#7d382f';
  const trimColor = '#f1d8ad';

  const backWall = box(12.4, 4.15, 0.28, wallColor);
  backWall.position.set(0, 2.1, -9.55);
  addOutline(backWall, 40);
  house.add(backWall);
  const leftWall = box(0.28, 4.15, 8.45, wallColor);
  leftWall.position.set(-6.2, 2.1, -5.33);
  house.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.x = 6.2;
  house.add(rightWall);

  // Visible interior log planks on the back wall.
  for (let i = 0; i < 16; i += 1) {
    const plank = box(0.06, 4.0, 0.04, i % 3 === 0 ? wallDark : '#b65b47');
    plank.position.set(-5.85 + i * 0.78, 2.1, -9.39);
    plank.castShadow = false;
    house.add(plank);
  }

  // Cutaway front: low sill wall + doorway frame, so the camera can see inside.
  const frontHeight = 0.82;
  const frontLeft = box(4.85, frontHeight, 0.24, wallColor);
  frontLeft.position.set(-3.7, frontHeight / 2, -1.13);
  const frontRight = frontLeft.clone();
  frontRight.position.x = 3.7;
  house.add(frontLeft, frontRight);
  const frontTopLeft = box(4.85, 0.16, 0.32, trimColor);
  frontTopLeft.position.set(-3.7, frontHeight, -1.13);
  const frontTopRight = frontTopLeft.clone();
  frontTopRight.position.x = 3.7;
  house.add(frontTopLeft, frontTopRight);

  const doorFrameL = box(0.22, 2.85, 0.38, trimColor);
  doorFrameL.position.set(-1.22, 1.42, -1.12);
  const doorFrameR = doorFrameL.clone();
  doorFrameR.position.x = 1.22;
  const doorHeader = box(2.66, 0.24, 0.38, trimColor);
  doorHeader.position.set(0, 2.87, -1.12);
  const doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.28, 2.66),
    new THREE.MeshBasicMaterial({ color: '#ffca7b', transparent: true, opacity: 0.16, side: THREE.DoubleSide })
  );
  doorGlow.position.set(0, 1.42, -1.01);
  house.add(doorFrameL, doorFrameR, doorHeader, doorGlow);
  const doorMat = rounded(2.2, 0.06, 1.6, '#6e4534', 0.1);
  doorMat.position.set(0, 0.08, -0.15);
  house.add(doorMat);

  // Roof gable silhouette and exposed beams.
  const gableGeo = new THREE.BufferGeometry();
  gableGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-6.3, 4.15, -9.66, 6.3, 4.15, -9.66, 0, 6.15, -9.66, -6.3, 4.15, -9.36, 6.3, 4.15, -9.36, 0, 6.15, -9.36],
      3
    )
  );
  gableGeo.setIndex([0, 1, 2, 5, 4, 3]);
  gableGeo.computeVertexNormals();
  const gable = new THREE.Mesh(gableGeo, mat('#8a3e33', { side: THREE.DoubleSide }));
  house.add(gable);
  house.add(tubeBetween([0, 6.1, -9.5], [0, 6.1, -0.9], 0.12, '#5a352d', 5));
  for (const x of [-6.05, 6.05]) {
    house.add(tubeBetween([x, 4.16, -9.5], [x, 4.16, -0.95], 0.1, '#5a352d', 5));
  }
  house.add(tubeBetween([-6.25, 4.1, -9.46], [0, 6.1, -9.46], 0.09, trimColor, 5));
  house.add(tubeBetween([6.25, 4.1, -9.46], [0, 6.1, -9.46], 0.09, trimColor, 5));

  // Chimney
  const chimney = box(1.0, 2.4, 0.9, '#8f4a3f');
  chimney.position.set(4.25, 5.1, -9.2);
  const chimneyTop = box(1.15, 0.18, 1.02, '#d7bf96');
  chimneyTop.position.set(4.25, 6.35, -9.2);
  house.add(chimney, chimneyTop);
  const snowCap = box(1.08, 0.1, 1.0, '#eef4f8');
  snowCap.position.set(4.25, 6.48, -9.2);
  house.add(snowCap);

  // Windows
  addWindow(house, -3.5, 2.9, -9.35, 1.2, 1.4);
  addWindow(house, 3.5, 2.9, -9.35, 1.2, 1.4);
  addWindow(house, -6.03, 2.8, -5.8, 1.25, 1.25, { curtains: true, curtainColor: '#d07a58' });
  addWindow(house, 6.03, 2.8, -5.8, 1.25, 1.25, { curtains: true, curtainColor: '#d07a58' });

  const windowLightL = new THREE.PointLight('#ffb35e', 6.5, 9, 2);
  windowLightL.position.set(-3.5, 2.4, -8.6);
  const windowLightR = windowLightL.clone();
  windowLightR.position.x = 3.5;
  const porchLight = new THREE.PointLight('#ffbd72', 8, 10, 2);
  porchLight.position.set(0, 3.25, 0.2);
  house.add(windowLightL, windowLightR, porchLight);
  world.animated.windowLights = [windowLightL, windowLightR];

  // Interior decorations
  const interiorWarm = new THREE.PointLight('#ff9d5c', 9, 7, 2);
  interiorWarm.position.set(0, 2.7, -5.8);
  house.add(interiorWarm);

  const rug = makeRug(5.4, 3.4, '#c9896b');
  rug.position.set(-2.75, 0.02, -5.85);
  house.add(rug);

  const shelf = box(3.2, 0.18, 0.45, '#b87f53');
  shelf.position.set(-0.2, 2.28, -9.22);
  house.add(shelf);
  for (let i = 0; i < 5; i += 1) {
    const book = box(0.17, 0.42 + (i % 2) * 0.12, 0.25, ['#e9c46a', '#7ee0c3', '#ff9ec7', '#8ecae6', '#b3a4ff'][i]);
    book.position.set(-1.2 + i * 0.28, 2.58, -9.18);
    book.rotation.z = i === 2 ? 0.22 : 0;
    house.add(book);
  }
  const plantPot = cyl(0.25, 0.2, 0.34, 8, '#e2765f');
  plantPot.position.set(2.4, 2.53, -9.15);
  house.add(plantPot);
  for (let i = 0; i < 4; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.48, 4), mat('#6d9d68'));
    leaf.position.set(2.4 + Math.sin(i * 1.7) * 0.18, 2.8 + i * 0.12, -9.15 + Math.cos(i) * 0.1);
    leaf.rotation.z = Math.sin(i) * 0.5;
    house.add(leaf);
  }

  const pictureFrame = box(1.2, 0.92, 0.08, '#e8c68d');
  pictureFrame.position.set(0.8, 3.0, -9.28);
  const picture = box(1.0, 0.72, 0.02, '#6c9b86');
  picture.position.set(0.8, 3.0, -9.23);
  house.add(pictureFrame, picture);

  const cat = makeCat();
  cat.position.set(1.35, 0.12, -5.4);
  house.add(cat);
  world.animated.cat = cat;

  const mug = cyl(0.11, 0.09, 0.17, 7, '#f2e6d0');
  mug.position.set(3.5, 0.14, -3.0);
  const coffee = cyl(0.09, 0.09, 0.02, 7, '#5a3b2f');
  coffee.position.set(3.5, 0.23, -3.0);
  house.add(mug, coffee);

  // A little floor lamp inside.
  const floorLampPole = cyl(0.035, 0.05, 2.3, 6, '#5a4c4a');
  floorLampPole.position.set(5.1, 1.25, -7.8);
  const floorLampShade = cone(0.34, 0.5, 8, '#ffd59b');
  floorLampShade.position.set(5.1, 2.4, -7.8);
  const floorLampGlow = new THREE.PointLight('#ffb65e', 4.2, 6, 2);
  floorLampGlow.position.set(5.1, 2.2, -7.8);
  house.add(floorLampPole, floorLampShade, floorLampGlow);

  // Porch deck and steps
  const porch = rounded(10.2, 0.18, 2.35, '#a77452', 0.08);
  porch.position.set(0, 0.045, -0.05);
  porch.receiveShadow = true;
  house.add(porch);
  for (let i = 0; i < 9; i += 1) {
    const seam = box(0.03, 0.012, 2.22, '#7e543c');
    seam.position.set(-4.5 + i * 1.1, 0.145, -0.05);
    seam.castShadow = false;
    house.add(seam);
  }
  const step = rounded(4.2, 0.18, 0.55, '#b4835d', 0.05);
  step.position.set(0, 0.02, 1.16);
  house.add(step);
  const porchLights = makeStringLights(
    [
      new THREE.Vector3(-5.7, 3.25, -1.0),
      new THREE.Vector3(-3.2, 2.62, 0.15),
      new THREE.Vector3(0, 2.95, 0.5),
      new THREE.Vector3(3.2, 2.62, 0.15),
      new THREE.Vector3(5.7, 3.25, -1.0),
    ],
    '#ffd166'
  );
  house.add(porchLights);
  world.animated.stringLights = [porchLights];

  const thresholdLight = new THREE.PointLight('#ffb15a', 4.5, 6, 2);
  thresholdLight.position.set(0, 1.4, -0.4);
  house.add(thresholdLight);


  // -------- OUTDOOR + INDOOR STATIONS --------
  const paci = makePaciBasket();
  paci.position.set(STATIONS.paci.x, 0, STATIONS.paci.z);
  scene.add(paci);
  world.stations.paci = {
    group: paci,
    item: 'pacifier',
    kind: 'pickup',
    position: new THREE.Vector3(STATIONS.paci.x, 0, STATIONS.paci.z),
  };

  const blankets = makeBlanketPile();
  blankets.position.set(STATIONS.blanket.x, 0, STATIONS.blanket.z);
  scene.add(blankets);
  world.stations.blanket = {
    group: blankets,
    item: 'blanket',
    kind: 'pickup',
    position: new THREE.Vector3(STATIONS.blanket.x, 0, STATIONS.blanket.z),
  };

  const bottleCrate = makeBottleCrate();
  bottleCrate.position.set(STATIONS.bottles.x, 0, STATIONS.bottles.z);
  scene.add(bottleCrate);
  world.stations.bottles = {
    group: bottleCrate,
    item: 'bottle',
    kind: 'pickup',
    position: new THREE.Vector3(STATIONS.bottles.x, 0, STATIONS.bottles.z),
  };

  const warmer = makeWarmer();
  warmer.position.set(STATIONS.warmer.x, 0, STATIONS.warmer.z);
  scene.add(warmer);
  world.stations.warmer = {
    group: warmer,
    kind: 'warmer',
    position: new THREE.Vector3(STATIONS.warmer.x, 0, STATIONS.warmer.z),
    state: 'empty',
    timer: 0,
    maxTimer: 2.4,
  };

  const teddyChest = makeTeddyChest();
  teddyChest.position.set(STATIONS.teddy.x, 0, STATIONS.teddy.z);
  scene.add(teddyChest);
  world.stations.teddy = {
    group: teddyChest,
    item: 'teddy',
    kind: 'pickup',
    position: new THREE.Vector3(STATIONS.teddy.x, 0, STATIONS.teddy.z),
  };

  const crib = createCrib();
  crib.position.set(STATIONS.crib.x, 0, STATIONS.crib.z);
  scene.add(crib);
  world.stations.crib = {
    group: crib,
    kind: 'crib',
    position: new THREE.Vector3(STATIONS.crib.x, 0, STATIONS.crib.z),
    state: 'empty',
    timer: 0,
    maxTimer: 3.1,
  };

  // -------- PRAMS --------
  for (let i = 0; i < PRAM_LAYOUTS.length; i += 1) {
    const layout = PRAM_LAYOUTS[i];
    const pram = createPram(i);
    pram.position.set(layout.x, 0, layout.z);
    pram.rotation.y = layout.rot;
    scene.add(pram);

    const icon = makeIconSprite('zzz', { scale: 0.64 });
    icon.position.set(0, 2.5, 0.1);
    pram.add(icon);

    const nameTag = makeNameTag(BABY_NAMES[i], PRAM_COLORS[i].trim);
    nameTag.position.set(0, 1.64, 0.86);
    nameTag.scale.set(0.82, 0.307, 1);
    pram.add(nameTag);

    const highlight = makeHighlight(1.15);
    highlight.group.position.set(layout.x, 0.03, layout.z);
    scene.add(highlight.group);

    const arrow = makeIconSprite('heart', { scale: 0.52, bg: '#ffd166' });
    arrow.visible = false;
    arrow.position.set(0, 2.9, 0);
    pram.add(arrow);

    addCircleShadow(pram, 0.95, 0.2);
    world.prams.push({
      index: i,
      group: pram,
      icon,
      nameTag,
      arrow,
      highlight,
      basePosition: new THREE.Vector3(layout.x, 0, layout.z),
      baseRotation: layout.rot,
      wheelGroups: pram.userData.wheels,
      collider: {
        minX: layout.x - 0.8,
        maxX: layout.x + 0.8,
        minZ: layout.z - 1.15,
        maxZ: layout.z + 1.15,
      },
    });
  }

  const stationIcons = {
    paci: makeIconSprite('pacifier', { scale: 0.58 }),
    blanket: makeIconSprite('blanket', { scale: 0.58 }),
    bottles: makeIconSprite('bottle', { scale: 0.58 }),
    warmer: makeIconSprite('bottle', { scale: 0.58, bg: '#ffe0b0' }),
    teddy: makeIconSprite('teddy', { scale: 0.58 }),
    crib: makeIconSprite('zzz', { scale: 0.58, bg: '#e4dcff' }),
  };
  const iconHeights = { paci: 1.95, blanket: 1.95, bottles: 1.72, warmer: 2.05, teddy: 1.95, crib: 2.2 };
  for (const [key, sprite] of Object.entries(stationIcons)) {
    const station = world.stations[key];
    if (!station) continue;
    sprite.position.set(station.position.x, iconHeights[key], station.position.z);
    sprite.userData.baseY = iconHeights[key];
    scene.add(sprite);
    station.icon = sprite;
  }

  const stationHighlightPositions = {
    paci: [STATIONS.paci.x, STATIONS.paci.z, 0.85],
    blanket: [STATIONS.blanket.x, STATIONS.blanket.z, 0.85],
    bottles: [STATIONS.bottles.x, STATIONS.bottles.z, 0.7],
    warmer: [STATIONS.warmer.x, STATIONS.warmer.z, 0.9],
    teddy: [STATIONS.teddy.x, STATIONS.teddy.z, 0.8],
    crib: [STATIONS.crib.x, STATIONS.crib.z, 1.4],
  };
  for (const [key, [x, z, radius]] of Object.entries(stationHighlightPositions)) {
    const station = world.stations[key];
    if (!station) continue;
    station.highlight = makeHighlight(radius);
    station.highlight.group.position.set(x, 0.03, z);
    scene.add(station.highlight.group);
  }

  // -------- FENCE, TREES, DECOR --------
  const fenceMat = '#6b5149';
  function addFenceLine(x1, z1, x2, z2, count) {
    const group = new THREE.Group();
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      const post = box(0.18, 1.2, 0.18, fenceMat);
      post.position.set(x, 0.6, z);
      group.add(post);
      const snow = sphere(0.14, '#eaf2f7', { widthSeg: 5, heightSeg: 4 });
      snow.position.set(x, 1.23, z);
      snow.scale.y = 0.4;
      group.add(snow);
      if (i < count) {
        const t2 = (i + 1) / count;
        const nx = x1 + (x2 - x1) * t2;
        const nz = z1 + (z2 - z1) * t2;
        for (const y of [0.38, 0.78]) {
          group.add(tubeBetween([x, y, z], [nx, y, nz], 0.055, '#85685b', 4));
        }
      }
    }
    scene.add(group);
    return group;
  }
  addFenceLine(-11.1, 9.9, 11.1, 9.9, 16);
  addFenceLine(-11.1, 0.4, -11.1, 9.9, 8);
  addFenceLine(11.1, 0.4, 11.1, 9.9, 8);

  const lampL = makeLampPost(-10.15, 4.0);
  const lampR = makeLampPost(10.15, 4.0);
  scene.add(lampL, lampR);
  world.animated.lampLights = [lampL, lampR];

  const treeDefs = [
    [-9.2, -5.4, 4.4, 'pine'],
    [8.9, -6.4, 5.2, 'pine'],
    [-12.4, 0.3, 4.8, 'pine'],
    [12.5, 1.0, 5.4, 'pine'],
    [-10.2, 10.1, 3.5, 'pine'],
    [9.8, 10.3, 4.2, 'pine'],
    [-13.7, 6.6, 4.5, 'pine'],
    [13.9, 7.3, 5.0, 'pine'],
    [-6.2, 11.4, 3.3, 'birch'],
    [6.4, 11.2, 3.8, 'birch'],
    [-14.8, -2.5, 5.4, 'pine'],
    [15.0, -4.0, 5.8, 'pine'],
  ];
  for (const [x, z, h, type] of treeDefs) {
    const tree = type === 'birch' ? createBirch(h) : createPine(h, Math.random() > 0.5 ? '#2f6e63' : '#376b5a');
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI;
    scene.add(tree);
  }

  const snowman = createSnowman();
  snowman.position.set(-8.6, 0, 8.2);
  snowman.rotation.y = 0.3;
  scene.add(snowman);
  world.colliders.push({ minX: -9.15, maxX: -8.05, minZ: 7.6, maxZ: 8.8 });

  const sled = new THREE.Group();
  const sledBody = rounded(0.9, 0.1, 0.45, '#d9574d', 0.04);
  sledBody.position.y = 0.25;
  sled.add(
    sledBody,
    tubeBetween([-0.4, 0.09, -0.2], [0.48, 0.09, -0.2], 0.025, '#b8c3d1', 4),
    tubeBetween([-0.4, 0.09, 0.2], [0.48, 0.09, 0.2], 0.025, '#b8c3d1', 4)
  );
  sled.position.set(8.8, 0.05, 2.0);
  sled.rotation.y = -0.75;
  scene.add(sled);

  const mailboxPost = box(0.14, 1.2, 0.14, '#6b5149');
  mailboxPost.position.set(-6.8, 0.6, 1.4);
  const mailbox = rounded(0.6, 0.42, 0.9, '#e26c5d', 0.08);
  mailbox.position.set(-6.8, 1.25, 1.4);
  const mailFlag = box(0.04, 0.55, 0.04, '#ffd166');
  mailFlag.position.set(-6.48, 1.5, 1.4);
  const addressSign = makeSign('BJØRKEVEIEN 3', '#f5e8d2', '#3a2a32', 300, 64);
  addressSign.scale.set(0.3, 0.3, 0.3);
  addressSign.position.set(-6.8, 1.24, 1.86);
  scene.add(mailboxPost, mailbox, mailFlag, addressSign);

  const norwegianFlag = createNorwegianFlag();
  scene.add(norwegianFlag);
  world.animated.norwegianFlag = norwegianFlag;

  const cribSign = makeSign('SOV GODT', '#e8ddff', '#3a2a32', 240, 84);
  cribSign.scale.set(0.55, 0.55, 0.55);
  cribSign.position.set(-3.35, 1.46, -6.06);
  scene.add(cribSign);

  for (let i = 0; i < 18; i += 1) {
    const drift = sphere(0.45 + Math.random() * 0.8, '#e4edf4', { widthSeg: 6, heightSeg: 4 });
    drift.position.set((Math.random() - 0.5) * 20, 0.1, 9.65 + Math.random() * 0.25);
    drift.scale.y = 0.32;
    drift.receiveShadow = true;
    scene.add(drift);
  }

  // -------- COLLIDERS --------
  world.colliders.push(
    { minX: -6.35, maxX: 6.35, minZ: -9.75, maxZ: -9.35 },
    { minX: -6.4, maxX: -6.02, minZ: -9.6, maxZ: -1.0 },
    { minX: 6.02, maxX: 6.4, minZ: -9.6, maxZ: -1.0 },
    { minX: -6.25, maxX: -1.3, minZ: -1.28, maxZ: -0.97 },
    { minX: 1.3, maxX: 6.25, minZ: -1.28, maxZ: -0.97 },
    { minX: -4.65, maxX: -2.05, minZ: -7.55, maxZ: -5.75 }, // crib
    { minX: 1.6, maxX: 3.5, minZ: -8.0, maxZ: -6.2 }, // warmer
    { minX: 3.9, maxX: 5.4, minZ: -5.4, maxZ: -4.2 }, // bottle crate
    { minX: 4.25, maxX: 5.75, minZ: -3.0, maxZ: -1.8 }, // teddy chest
    { minX: -5.55, maxX: -3.55, minZ: -0.25, maxZ: 0.95 }, // paci table
    { minX: 3.55, maxX: 5.55, minZ: -0.25, maxZ: 0.95 }, // blanket bench
    { minX: -9.15, maxX: -8.05, minZ: 7.6, maxZ: 8.8 } // snowman
  );
  for (const pram of world.prams) world.colliders.push(pram.collider);

  // Ambient snow particles
  const snowCount = options.mobile ? 650 : 1000;
  const snowPositions = new Float32Array(snowCount * 3);
  const snowVelocities = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i += 1) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 32;
    snowPositions[i * 3 + 1] = Math.random() * 16;
    snowPositions[i * 3 + 2] = -14 + Math.random() * 28;
    snowVelocities[i] = 0.35 + Math.random() * 0.75;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snowTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 2, 4, 4);
    return new THREE.CanvasTexture(canvas);
  })();
  const snowMat = new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.13,
    map: snowTexture,
    transparent: true,
    opacity: 0.72,
    alphaTest: 0.2,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  scene.add(snow);
  world.animated.snow = { points: snow, velocities: snowVelocities, count: snowCount };

  // Chimney smoke
  const smokeGroup = new THREE.Group();
  smokeGroup.position.set(4.25, 6.5, -9.2);
  const smoke = [];
  for (let i = 0; i < 9; i += 1) {
    const puff = sphere(0.18 + Math.random() * 0.12, '#a9b5c6', {
      widthSeg: 5,
      heightSeg: 4,
      matOptions: { transparent: true, opacity: 0.12, depthWrite: false },
    });
    puff.position.set((Math.random() - 0.5) * 0.25, i * 0.35, (Math.random() - 0.5) * 0.25);
    puff.userData.phase = Math.random() * 5;
    smoke.push(puff);
    smokeGroup.add(puff);
  }
  scene.add(smokeGroup);
  world.animated.smoke = smoke;
  world.animated.smokeGroup = smokeGroup;

  const fox = createFox();
  fox.visible = false;
  scene.add(fox);
  world.fox = fox;

  const moteGeo = new THREE.BufferGeometry();
  const motePositions = new Float32Array(70 * 3);
  for (let i = 0; i < 70; i += 1) {
    motePositions[i * 3] = (Math.random() - 0.5) * 13;
    motePositions[i * 3 + 1] = 0.5 + Math.random() * 2.8;
    motePositions[i * 3 + 2] = -7 + Math.random() * 9;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ color: '#ffd897', size: 0.035, transparent: true, opacity: 0.7, depthWrite: false })
  );
  scene.add(motes);
  world.animated.motes = motes;

  for (const pram of world.prams) {
    pram.group.visible = pram.index < 3;
    pram.highlight.group.visible = false;
  }

  world.setShiftMood = (shiftIndex = 0) => {
    const moods = [
      {
        bg: '#bcd6e7',
        fog: '#cddae2',
        fogDensity: 0.012,
        skyTop: '#6ea4cf',
        skyMid: '#d5e5ee',
        skyBottom: '#ffe5c5',
        hemiSky: '#dceeff',
        hemiGround: '#8b7c86',
        hemiIntensity: 1.3,
        ambient: '#ffe8cf',
        ambientIntensity: 0.24,
        sun: '#ffe3b4',
        sunIntensity: 2.75,
        aurora: [0.04, 0.03, 0.02],
        halo: 0.18,
      },
      {
        bg: '#d9c3ad',
        fog: '#dfc9b3',
        fogDensity: 0.013,
        skyTop: '#6b9ac4',
        skyMid: '#f1c7a5',
        skyBottom: '#ffd8a3',
        hemiSky: '#ffe0c4',
        hemiGround: '#765e62',
        hemiIntensity: 1.22,
        ambient: '#ffc89e',
        ambientIntensity: 0.26,
        sun: '#ffb96e',
        sunIntensity: 2.9,
        aurora: [0.1, 0.07, 0.05],
        halo: 0.28,
      },
      {
        bg: '#a99ab6',
        fog: '#b3a6b8',
        fogDensity: 0.014,
        skyTop: '#536894',
        skyMid: '#c7a9bb',
        skyBottom: '#f3b78d',
        hemiSky: '#cdb8e5',
        hemiGround: '#635568',
        hemiIntensity: 1.16,
        ambient: '#c5a9c8',
        ambientIntensity: 0.28,
        sun: '#ffc396',
        sunIntensity: 2.35,
        aurora: [0.16, 0.14, 0.12],
        halo: 0.34,
      },
    ];
    const mood = moods[Math.min(shiftIndex, moods.length - 1)];
    scene.background.set(mood.bg);
    scene.fog.color.set(mood.fog);
    scene.fog.density = mood.fogDensity;
    const uniforms = world.animated.sky.material.uniforms;
    uniforms.topColor.value.set(mood.skyTop);
    uniforms.midColor.value.set(mood.skyMid);
    uniforms.bottomColor.value.set(mood.skyBottom);
    world.hemisphere.color.set(mood.hemiSky);
    world.hemisphere.groundColor.set(mood.hemiGround);
    world.hemisphere.intensity = mood.hemiIntensity;
    world.ambient.color.set(mood.ambient);
    world.ambient.intensity = mood.ambientIntensity;
    world.sunLight.color.set(mood.sun);
    world.sunLight.intensity = mood.sunIntensity;
    world.animated.auroras.forEach((aurora, i) => {
      aurora.material.uniforms.uOpacity.value = mood.aurora[i] || mood.aurora[0];
    });
    if (world.animated.halo) {
      world.animated.halo.material.opacity = mood.halo;
    }
  };
  world.setShiftMood(0);

  world.update = (dt, elapsed, gameIntensity = 0) => {
    const pos = world.animated.snow.points.geometry.attributes.position.array;
    const vel = world.animated.snow.velocities;
    for (let i = 0; i < world.animated.snow.count; i += 1) {
      pos[i * 3 + 1] -= vel[i] * dt;
      pos[i * 3] += Math.sin(elapsed * 0.3 + i) * dt * 0.08;
      if (pos[i * 3 + 1] < -0.2) {
        pos[i * 3 + 1] = 15;
        pos[i * 3] = (Math.random() - 0.5) * 32;
        pos[i * 3 + 2] = -14 + Math.random() * 28;
      }
    }
    world.animated.snow.points.geometry.attributes.position.needsUpdate = true;

    for (const aurora of world.animated.auroras) {
      aurora.material.uniforms.uTime.value = elapsed;
    }
    for (const puff of world.animated.smoke) {
      puff.position.y += dt * (0.1 + (puff.userData.phase % 1) * 0.06);
      puff.position.x += Math.sin(elapsed * 0.4 + puff.userData.phase) * dt * 0.055;
      if (puff.position.y > 4.3) {
        puff.position.y = 0;
        puff.position.x = (Math.random() - 0.5) * 0.25;
        puff.position.z = (Math.random() - 0.5) * 0.25;
      }
      puff.material.opacity = 0.06 + Math.max(0, 0.14 - puff.position.y * 0.025);
    }
    world.animated.smokeGroup.rotation.y = Math.sin(elapsed * 0.15) * 0.05;

    world.animated.motes.rotation.y = elapsed * 0.015;
    world.animated.motes.position.y = Math.sin(elapsed * 0.4) * 0.1;

    if (world.animated.norwegianFlag) {
      const flagGroup = world.animated.norwegianFlag.userData.flagGroup;
      flagGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.06 - 0.02;
      flagGroup.rotation.z = Math.sin(elapsed * 0.9) * 0.012;
    }

    for (const lights of world.animated.stringLights) {
      lights.userData.bulbs.forEach((bulb, i) => {
        const twinkle = 0.8 + Math.sin(elapsed * 2.2 + i * 1.3 + lights.userData.phase) * 0.35;
        bulb.material.emissiveIntensity = 0.55 * twinkle;
      });
    }

    if (world.animated.cat) {
      world.animated.cat.userData.tail.rotation.y = Math.sin(elapsed * 0.7) * 0.18;
      world.animated.cat.position.y = 0.12 + Math.sin(elapsed * 1.2) * 0.006;
    }

    for (const [i, lamp] of world.animated.lampLights.entries()) {
      const light = lamp.children.find((child) => child.isPointLight);
      if (light) light.intensity = 3.4 + Math.sin(elapsed * 2.1 + i * 2.4) * 0.35;
    }
    if (world.animated.windowLights) {
      world.animated.windowLights.forEach((light, i) => {
        light.intensity = 6.5 + Math.sin(elapsed * 1.3 + i * 1.7) * 0.55;
      });
    }

    for (const pram of world.prams) {
      if (!pram.group.visible) continue;
      const userData = pram.group.userData;
      if (userData.hangingToy) userData.hangingToy.rotation.y = elapsed * 0.18 + pram.index;
      if (userData.star) userData.star.rotation.y = elapsed * 0.7;
      if (userData.babyGroup && userData.babyGroup.visible) {
        userData.babyGroup.position.y = 1.03 + Math.sin(elapsed * 1.5 + pram.index) * 0.008;
      }
      pram.icon.position.y = 2.5 + Math.sin(elapsed * 1.7 + pram.index * 0.8) * 0.05;
      if (pram.arrow.visible) {
        pram.arrow.position.y = 2.95 + Math.sin(elapsed * 3.2) * 0.12;
      }
    }

    for (const station of Object.values(world.stations)) {
      if (station.icon) {
        station.icon.position.y =
          (station.icon.userData.baseY || station.icon.position.y) + Math.sin(elapsed * 1.5 + station.position.x) * 0.04;
      }
    }

    const cribMobile = world.stations.crib.group.userData.mobile;
    if (cribMobile) cribMobile.rotation.y = elapsed * 0.25;

    interiorWarm.intensity = 9 + Math.sin(elapsed * 1.7) * 0.8 + gameIntensity * 3;
    if (world.stations.warmer.state === 'warming') {
      const warmerStation = world.stations.warmer;
      warmerStation.group.userData.burner.material.emissiveIntensity = 1.2 + Math.sin(elapsed * 9) * 0.35;
    }
  };

  return world;
}
