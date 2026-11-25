import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getIconCanvas } from './icons.js';
import { PRAM_COLORS } from './config.js';

const materialCache = new Map();
const outlineMaterial = new THREE.LineBasicMaterial({
  color: 0x241b38,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
});

export function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 0.82,
        metalness: 0.02,
        ...options,
      })
    );
  }
  return materialCache.get(key);
}

export function glowMat(color, intensity = 1.8, opacity = 1) {
  const key = `glow|${color}|${intensity}|${opacity}`;
  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.5,
        transparent: opacity < 1,
        opacity,
        flatShading: true,
      })
    );
  }
  return materialCache.get(key);
}

export function box(w, h, d, color, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(color, opts.matOptions));
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  return mesh;
}

export function rounded(w, h, d, color, radius = 0.08, opts = {}) {
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, opts.segments || 2, Math.min(radius, w / 2, h / 2, d / 2)),
    opts.material || mat(color, opts.matOptions)
  );
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  return mesh;
}

export function cyl(rTop, rBottom, h, segments, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, h, segments, opts.heightSegments || 1),
    opts.material || mat(color, opts.matOptions)
  );
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  return mesh;
}

export function sphere(r, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, opts.widthSeg || 8, opts.heightSeg || 6),
    opts.material || mat(color, opts.matOptions)
  );
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  return mesh;
}

export function cone(r, h, segments, color, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), opts.material || mat(color, opts.matOptions));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function addOutline(mesh, threshold = 35) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
  const line = new THREE.LineSegments(edges, outlineMaterial);
  line.renderOrder = 2;
  mesh.add(line);
  return line;
}

export function tubeBetween(a, b, radius, color, segments = 6) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const distance = start.distanceTo(end);
  const mesh = cyl(radius, radius, distance, segments, color);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  return mesh;
}

function faceEyes(parent, z, y, spacing, color = '#2d2342', r = 0.035) {
  const material = new THREE.MeshBasicMaterial({ color });
  const left = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), material);
  left.position.set(-spacing, y, z);
  const right = left.clone();
  right.position.x = spacing;
  parent.add(left, right);
  return [left, right];
}

export function createPlayer() {
  const group = new THREE.Group();
  group.name = 'player';
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const bootColor = '#332b47';
  const parkaColor = '#f0875e';
  const trimColor = '#ffe5c4';
  const scarfColor = '#7ee0c3';
  const skinColor = '#f6c99f';

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.19, 0.7, 0);
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.19, 0.7, 0);

  for (const leg of [leftLeg, rightLeg]) {
    const trouser = rounded(0.24, 0.55, 0.27, '#4c4260', 0.08);
    trouser.position.y = -0.26;
    const boot = rounded(0.28, 0.22, 0.42, bootColor, 0.08);
    boot.position.set(0, -0.58, 0.07);
    const sole = box(0.3, 0.07, 0.45, '#171222');
    sole.position.set(0, -0.69, 0.07);
    leg.add(trouser, boot, sole);
  }
  bodyGroup.add(leftLeg, rightLeg);

  const torso = new THREE.Group();
  torso.position.y = 0.68;
  const jacket = rounded(0.78, 0.79, 0.55, parkaColor, 0.16);
  jacket.position.y = 0.38;
  addOutline(jacket, 42);
  const jacketBelly = rounded(0.62, 0.42, 0.58, '#ffa376', 0.13);
  jacketBelly.position.set(0, 0.24, 0.02);
  const hem = rounded(0.79, 0.13, 0.57, trimColor, 0.06);
  hem.position.y = 0.02;
  const zipper = box(0.05, 0.55, 0.02, '#412f4a');
  zipper.position.set(0, 0.4, 0.287);
  torso.add(jacket, jacketBelly, hem, zipper);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.45, 0.68, 0);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.45, 0.68, 0);
  for (const arm of [leftArm, rightArm]) {
    const sleeve = rounded(0.22, 0.6, 0.24, parkaColor, 0.09);
    sleeve.position.y = -0.27;
    const cuff = rounded(0.24, 0.12, 0.26, trimColor, 0.05);
    cuff.position.y = -0.55;
    const mitten = sphere(0.14, '#4c4260', { widthSeg: 7, heightSeg: 5 });
    mitten.position.y = -0.66;
    mitten.scale.z = 1.2;
    arm.add(sleeve, cuff, mitten);
  }
  torso.add(leftArm, rightArm);
  bodyGroup.add(torso);

  const head = new THREE.Group();
  head.position.y = 1.67;
  const face = sphere(0.33, skinColor, { widthSeg: 10, heightSeg: 8 });
  face.scale.set(1, 1.04, 0.96);
  addOutline(face, 55);
  const eyes = faceEyes(head, 0.295, 0.02, 0.115, '#2b233d', 0.034);
  eyes.forEach((eye) => {
    eye.scale.y = 1.35;
  });
  const blushMat = new THREE.MeshBasicMaterial({ color: '#f5a184' });
  const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.055, 7), blushMat);
  blushL.position.set(-0.19, -0.08, 0.29);
  const blushR = blushL.clone();
  blushR.position.x = 0.19;
  const nose = sphere(0.035, '#dfa57e', { widthSeg: 6, heightSeg: 4 });
  nose.position.set(0, -0.02, 0.333);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 4, 8, Math.PI), new THREE.MeshBasicMaterial({ color: '#7d4a51' }));
  mouth.position.set(0, -0.12, 0.31);
  mouth.rotation.x = 0.2;
  head.add(face, blushL, blushR, nose, mouth);

  const hat = new THREE.Group();
  const beanie = cyl(0.3, 0.34, 0.29, 9, '#e85f6d');
  beanie.position.y = 0.22;
  const brim = cyl(0.35, 0.35, 0.1, 9, '#ffd166');
  brim.position.y = 0.08;
  const pom = sphere(0.12, '#fff6df', { widthSeg: 7, heightSeg: 5 });
  pom.position.y = 0.43;
  hat.add(beanie, brim, pom);
  head.add(hat);

  const hairMat = mat('#6b4739');
  for (let i = 0; i < 4; i += 1) {
    const curl = sphere(0.11, '#6b4739', { widthSeg: 6, heightSeg: 4 });
    curl.position.set(-0.23 + i * 0.15, -0.27, -0.06);
    curl.scale.set(1, 0.8, 1);
    head.add(curl);
  }
  bodyGroup.add(head);

  const scarf = new THREE.Group();
  const wrap = cyl(0.37, 0.38, 0.16, 9, scarfColor);
  wrap.position.y = 1.37;
  const tail1 = rounded(0.17, 0.55, 0.1, scarfColor, 0.04);
  tail1.position.set(0.16, 1.08, 0.27);
  tail1.rotation.z = -0.12;
  const tail2 = rounded(0.15, 0.4, 0.09, '#5ccdb3', 0.04);
  tail2.position.set(0.23, 1.18, 0.29);
  tail2.rotation.z = 0.16;
  scarf.add(wrap, tail1, tail2);
  bodyGroup.add(scarf);

  // A tiny thermos and a "nap shift" badge for character.
  const badge = box(0.15, 0.11, 0.03, '#ffd166');
  badge.position.set(-0.2, 1.08, 0.29);
  bodyGroup.add(badge);

  const handAnchor = new THREE.Group();
  handAnchor.position.set(0, 1.23, 0.62);
  bodyGroup.add(handAnchor);

  group.userData = {
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    handAnchor,
    pom,
    jacket,
  };
  group.scale.setScalar(0.98);
  return group;
}

function createBabyFace(color) {
  const g = new THREE.Group();
  const head = sphere(0.22, '#f6c99f', { widthSeg: 8, heightSeg: 6 });
  head.scale.set(1, 1.05, 0.98);
  const hat = cyl(0.21, 0.23, 0.14, 8, color);
  hat.position.y = 0.16;
  const pom = sphere(0.07, '#fff6df', { widthSeg: 6, heightSeg: 4 });
  pom.position.y = 0.27;
  const eyes = faceEyes(g, 0.205, -0.01, 0.07, '#3b2a42', 0.02);
  eyes.forEach((e) => (e.scale.y = 0.65));
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.008, 4, 6, Math.PI),
    new THREE.MeshBasicMaterial({ color: '#8b5158' })
  );
  mouth.position.set(0, -0.09, 0.205);
  mouth.rotation.z = Math.PI;
  g.add(head, hat, pom, mouth);
  const cheekMat = new THREE.MeshBasicMaterial({ color: '#f4a88e' });
  const c1 = new THREE.Mesh(new THREE.CircleGeometry(0.032, 6), cheekMat);
  c1.position.set(-0.12, -0.06, 0.185);
  const c2 = c1.clone();
  c2.position.x = 0.12;
  g.add(c1, c2);
  return g;
}

export function createPram(index = 0) {
  const colors = PRAM_COLORS[index % PRAM_COLORS.length];
  const group = new THREE.Group();
  group.name = `pram-${index}`;
  const shakeGroup = new THREE.Group();
  group.add(shakeGroup);

  const wheelMat = new THREE.MeshStandardMaterial({ color: '#25203a', roughness: 0.75 });
  const hubMat = mat('#d7c9a8');
  const wheelFrontL = new THREE.Group();
  wheelFrontL.position.set(-0.52, 0.25, 0.5);
  const wheelFrontR = wheelFrontL.clone();
  wheelFrontR.position.x = 0.52;
  for (const wheel of [wheelFrontL, wheelFrontR]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tire, hub);
    group.add(wheel);
  }
  const rearL = new THREE.Group();
  rearL.position.set(-0.56, 0.31, -0.53);
  const rearR = rearL.clone();
  rearR.position.x = 0.56;
  for (const wheel of [rearL, rearR]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.13, 10), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.15, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tire, hub);
    group.add(wheel);
  }

  const frameMat = mat('#d9c7a4');
  const axle = tubeBetween([-0.52, 0.31, -0.53], [0.52, 0.31, -0.53], 0.035, '#d9c7a4', 5);
  group.add(axle);
  const frontAxle = tubeBetween([-0.52, 0.25, 0.5], [0.52, 0.25, 0.5], 0.03, '#d9c7a4', 5);
  group.add(frontAxle);

  const basket = rounded(1.08, 0.62, 1.7, colors.body, 0.24, { segments: 3 });
  basket.position.set(0, 0.74, 0);
  addOutline(basket, 38);
  shakeGroup.add(basket);

  const inner = rounded(0.9, 0.08, 1.5, '#3b344d', 0.12);
  inner.position.set(0, 1.02, 0.03);
  shakeGroup.add(inner);

  const underBasket = rounded(0.88, 0.2, 1.42, colors.canopy, 0.08);
  underBasket.position.set(0, 0.38, 0);
  shakeGroup.add(underBasket);

  const rimSideL = rounded(0.08, 0.09, 1.64, colors.trim, 0.03);
  rimSideL.position.set(-0.53, 1.065, 0);
  const rimSideR = rimSideL.clone();
  rimSideR.position.x = 0.53;
  const rimBack = rounded(1.06, 0.09, 0.08, colors.trim, 0.03);
  rimBack.position.set(0, 1.065, -0.79);
  const rimFront = rimBack.clone();
  rimFront.position.z = 0.79;
  shakeGroup.add(rimSideL, rimSideR, rimBack, rimFront);

  // A curved quarter-shell hood: open at the front so the baby can breathe.
  const hood = new THREE.Group();
  hood.position.set(0, 1.03, 0.14);
  const hoodWidth = 1.1;
  const hoodRadius = 0.66;
  const hoodSegments = 7;
  const hoodPositions = [];
  const hoodUvs = [];
  const hoodIndices = [];
  for (let row = 0; row <= 1; row += 1) {
    for (let i = 0; i <= hoodSegments; i += 1) {
      const t = i / hoodSegments;
      const angle = (t * Math.PI) / 2;
      hoodPositions.push((row === 0 ? -1 : 1) * (hoodWidth / 2), Math.sin(angle) * hoodRadius, -Math.cos(angle) * hoodRadius);
      hoodUvs.push(row, t);
    }
  }
  for (let i = 0; i < hoodSegments; i += 1) {
    const a = i;
    const b = i + 1;
    const c = hoodSegments + 1 + i;
    const d = hoodSegments + 1 + i + 1;
    hoodIndices.push(a, c, b, b, c, d);
  }
  const hoodGeo = new THREE.BufferGeometry();
  hoodGeo.setAttribute('position', new THREE.Float32BufferAttribute(hoodPositions, 3));
  hoodGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hoodUvs, 2));
  hoodGeo.setIndex(hoodIndices);
  hoodGeo.computeVertexNormals();
  const hoodMesh = new THREE.Mesh(
    hoodGeo,
    mat(colors.canopy, { side: THREE.DoubleSide, roughness: 0.95 })
  );
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  addOutline(hoodMesh, 15);
  hood.add(hoodMesh);

  // Ribs and a soft contrast stripe make the fabric feel like a real pram hood.
  for (const t of [0.28, 0.52, 0.76]) {
    const angle = t * Math.PI / 2;
    const y = Math.sin(angle) * (hoodRadius + 0.015);
    const z = -Math.cos(angle) * (hoodRadius + 0.015);
    const rib = tubeBetween([-hoodWidth / 2, y, z], [hoodWidth / 2, y, z], 0.018, colors.trim, 4);
    hood.add(rib);
  }
  const rimPoints = [];
  for (let i = 0; i <= hoodSegments; i += 1) {
    const angle = (i / hoodSegments) * Math.PI / 2;
    rimPoints.push(
      new THREE.Vector3(
        -hoodWidth / 2,
        Math.sin(angle) * (hoodRadius + 0.012),
        -Math.cos(angle) * (hoodRadius + 0.012)
      )
    );
  }
  const rimCurve = new THREE.CatmullRomCurve3(rimPoints);
  const rim = new THREE.Mesh(
    new THREE.TubeGeometry(rimCurve, 16, 0.027, 4, false),
    mat(colors.trim)
  );
  rim.castShadow = true;
  hood.add(rim);
  const rimMirror = rim.clone();
  rimMirror.position.x = hoodWidth;
  hood.add(rimMirror);
  const topRail = tubeBetween([-hoodWidth / 2, hoodRadius + 0.01, 0], [hoodWidth / 2, hoodRadius + 0.01, 0], 0.025, colors.trim, 5);
  hood.add(topRail);

  // Flat-quarter side panels give the hood a satisfying silhouette from every angle.
  const sideMaterial = mat(colors.canopy, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const sidePositions = [0, 0, 0];
    const sideIndices = [];
    for (let i = 0; i <= hoodSegments; i += 1) {
      const angle = (i / hoodSegments) * Math.PI / 2;
      sidePositions.push(0, Math.sin(angle) * hoodRadius, -Math.cos(angle) * hoodRadius);
      if (i > 0) {
        const center = 0;
        const prev = i;
        const current = i + 1;
        sideIndices.push(center, prev, current);
      }
    }
    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
    sideGeo.setIndex(sideIndices);
    sideGeo.computeVertexNormals();
    const sideMesh = new THREE.Mesh(sideGeo, sideMaterial);
    sideMesh.position.x = side * (hoodWidth / 2 + 0.01);
    sideMesh.castShadow = true;
    hood.add(sideMesh);
  }

  // A soft scalloped valance at the front edge.
  for (let i = 0; i < 4; i += 1) {
    const tab = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 5, 0, Math.PI),
      mat(colors.trim, { side: THREE.DoubleSide })
    );
    tab.position.set(-0.39 + i * 0.26, hoodRadius - 0.10, 0.015);
    tab.rotation.z = Math.PI;
    hood.add(tab);
  }
  shakeGroup.add(hood);

  const handleBar = new THREE.Group();
  handleBar.add(tubeBetween([-0.45, 0.9, -0.84], [-0.45, 1.36, -0.98], 0.04, '#d9c7a4', 6));
  handleBar.add(tubeBetween([0.45, 0.9, -0.84], [0.45, 1.36, -0.98], 0.04, '#d9c7a4', 6));
  handleBar.add(tubeBetween([-0.45, 1.36, -0.98], [0.45, 1.36, -0.98], 0.05, '#7ee0c3', 7));
  shakeGroup.add(handleBar);

  const wheels = [wheelFrontL, wheelFrontR, rearL, rearR];

  // The baby must stay visually legible from the fixed camera.
  const babyGroup = new THREE.Group();
  babyGroup.position.set(0, 1.03, 0.1);
  babyGroup.rotation.x = -0.18;
  const babyFace = createBabyFace(colors.blanket);
  babyFace.position.set(0, 0.18, 0.16);
  babyFace.rotation.x = -0.48;
  const bundle = rounded(0.64, 0.24, 0.72, colors.blanket, 0.13);
  bundle.position.set(0, 0.0, 0.0);
  const blanketFold = rounded(0.72, 0.11, 0.62, colors.trim, 0.05);
  blanketFold.position.set(0, 0.09, 0.02);
  const blanketEdge = rounded(0.72, 0.06, 0.12, colors.body, 0.025);
  blanketEdge.position.set(0, 0.12, 0.31);
  babyGroup.add(bundle, blanketFold, blanketEdge, babyFace);

  const hangingToy = new THREE.Group();
  const toyArm = tubeBetween([0, 0.8, 0.68], [0, 0.8, -0.12], 0.015, '#e8dcc2', 4);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), glowMat('#ffd166', 0.5));
  star.position.set(0, 0.64, 0.18);
  const star2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), mat('#ff9ec7'));
  star2.position.set(0, 0.56, -0.02);
  hangingToy.add(toyArm, star, star2);
  shakeGroup.add(babyGroup, hangingToy);

  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.18),
    new THREE.MeshBasicMaterial({ color: colors.trim, side: THREE.DoubleSide })
  );
  tag.position.set(0.28, 0.58, 0.85);
  tag.rotation.x = -0.2;
  shakeGroup.add(tag);

  group.userData = {
    colors,
    shakeGroup,
    hood,
    babyGroup,
    babyFace,
    hangingToy,
    wheels,
    star,
  };
  return group;
}

export function createBabyBundle(color = '#f6d365', nameColor = '#ff9ec7') {
  const group = new THREE.Group();
  const bundle = rounded(0.58, 0.34, 0.62, color, 0.15);
  bundle.position.y = -0.08;
  const face = createBabyFace(color);
  face.position.set(0, 0.18, 0.13);
  face.rotation.x = -0.2;
  const wrap = rounded(0.66, 0.1, 0.7, '#fff6df', 0.05);
  wrap.position.y = 0.06;
  const foot = sphere(0.11, color, { widthSeg: 6, heightSeg: 4 });
  foot.position.set(0.2, -0.24, 0.2);
  group.add(bundle, wrap, foot, face);
  group.userData = { face, bundle };
  return group;
}

export function createItem(type) {
  const g = new THREE.Group();
  if (type === 'pacifier') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 5, 10), mat('#ff9ec7'));
    ring.position.y = 0.18;
    ring.rotation.x = 0.5;
    const shield = rounded(0.28, 0.08, 0.18, '#ffd166', 0.04);
    shield.position.y = 0.05;
    const nipple = cyl(0.055, 0.07, 0.12, 6, '#fff6df');
    nipple.position.y = -0.04;
    g.add(ring, shield, nipple);
    g.scale.setScalar(1.1);
  } else if (type === 'bottle') {
    const body = cyl(0.11, 0.13, 0.38, 8, '#bfe7f0', { matOptions: { transparent: true, opacity: 0.92, roughness: 0.3 } });
    body.position.y = 0.14;
    const milk = cyl(0.085, 0.105, 0.22, 8, '#fff4cf');
    milk.position.y = 0.1;
    const ring = cyl(0.135, 0.135, 0.08, 8, '#ffd166');
    ring.position.y = 0.37;
    const teat = cyl(0.055, 0.08, 0.11, 7, '#f5c99f');
    teat.position.y = 0.46;
    g.add(body, milk, ring, teat);
    g.scale.setScalar(1.15);
  } else if (type === 'blanket') {
    const b1 = rounded(0.46, 0.11, 0.5, '#8ecae6', 0.04);
    b1.position.y = 0.1;
    b1.rotation.y = 0.1;
    const b2 = rounded(0.42, 0.1, 0.45, '#b8e6f3', 0.04);
    b2.position.y = 0.21;
    b2.rotation.y = -0.08;
    const stripe = rounded(0.46, 0.02, 0.12, '#fff6df', 0.01);
    stripe.position.set(0, 0.27, 0.08);
    g.add(b1, b2, stripe);
    g.scale.setScalar(1.25);
  } else if (type === 'teddy') {
    const body = rounded(0.3, 0.35, 0.24, '#c98b5b', 0.12);
    body.position.y = 0.18;
    const head = sphere(0.17, '#c98b5b', { widthSeg: 8, heightSeg: 6 });
    head.position.y = 0.44;
    const earL = sphere(0.08, '#a96f46', { widthSeg: 6, heightSeg: 4 });
    earL.position.set(-0.13, 0.56, 0);
    const earR = earL.clone();
    earR.position.x = 0.13;
    const snout = sphere(0.08, '#f0c89e', { widthSeg: 6, heightSeg: 4 });
    snout.position.set(0, 0.41, 0.15);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#2d2342' });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 5, 4), eyeMat);
    e1.position.set(-0.06, 0.47, 0.16);
    const e2 = e1.clone();
    e2.position.x = 0.06;
    const armL = sphere(0.09, '#b97b4f', { widthSeg: 6, heightSeg: 4 });
    armL.position.set(-0.19, 0.23, 0.05);
    const armR = armL.clone();
    armR.position.x = 0.19;
    const belly = rounded(0.18, 0.2, 0.02, '#e4b889', 0.03);
    belly.position.set(0, 0.2, 0.13);
    g.add(body, head, earL, earR, snout, e1, e2, armL, armR, belly);
    g.scale.setScalar(0.95);
  }
  return g;
}

export function createCrib() {
  const group = new THREE.Group();
  const wood = '#d2a66d';
  const woodDark = '#a47748';
  const mattress = rounded(1.9, 0.22, 1.02, '#f2e6d0', 0.08);
  mattress.position.y = 0.64;
  const blanket = rounded(1.3, 0.14, 0.86, '#b8f2e6', 0.08);
  blanket.position.set(-0.18, 0.78, 0);
  blanket.visible = false;
  const baby = createBabyBundle('#b8f2e6');
  baby.position.set(-0.12, 0.84, 0.02);
  baby.rotation.z = Math.PI / 2;
  baby.scale.setScalar(0.8);
  baby.visible = false;
  group.add(mattress, blanket, baby);

  for (const z of [-0.51, 0.51]) {
    const rail = box(1.96, 0.13, 0.12, wood);
    rail.position.set(0, 0.56, z);
    const railTop = box(1.96, 0.1, 0.1, woodDark);
    railTop.position.set(0, 1.15, z);
    group.add(rail, railTop);
  }
  for (let i = 0; i < 7; i += 1) {
    const x = -0.84 + i * 0.28;
    for (const z of [-0.51, 0.51]) {
      const slat = box(0.065, 0.56, 0.065, wood);
      slat.position.set(x, 0.87, z);
      group.add(slat);
    }
  }
  for (const x of [-1.03, 1.03]) {
    for (const z of [-0.55, 0.55]) {
      const post = rounded(0.12, 1.2, 0.12, woodDark, 0.035);
      post.position.set(x, 0.6, z);
      group.add(post);
      const knob = sphere(0.09, '#e8cc9c', { widthSeg: 6, heightSeg: 4 });
      knob.position.set(x, 1.25, z);
      group.add(knob);
    }
  }
  const legs = new THREE.Group();
  for (const x of [-0.92, 0.92]) {
    for (const z of [-0.45, 0.45]) {
      const leg = box(0.1, 0.48, 0.1, woodDark);
      leg.position.set(x, 0.24, z);
      legs.add(leg);
    }
  }
  group.add(legs);

  const mobile = new THREE.Group();
  const arm = tubeBetween([0.9, 1.3, -0.44], [0.9, 2.0, -0.44], 0.025, '#7c5b3e', 5);
  const arm2 = tubeBetween([0.9, 2.0, -0.44], [0.35, 1.9, -0.15], 0.025, '#7c5b3e', 5);
  const hanging = new THREE.Group();
  hanging.position.set(0.35, 1.9, -0.15);
  for (let i = 0; i < 3; i += 1) {
    const string = tubeBetween([(i - 1) * 0.2, 0, 0], [(i - 1) * 0.2, -0.42, 0], 0.008, '#ece1c8', 3);
    const shape = new THREE.Mesh(
      i === 1 ? new THREE.OctahedronGeometry(0.1, 0) : new THREE.TetrahedronGeometry(0.1, 0),
      glowMat(i === 1 ? '#ffd166' : i === 0 ? '#ff9ec7' : '#7ee0c3', 0.6)
    );
    shape.position.set((i - 1) * 0.2, -0.48, 0);
    hanging.add(string, shape);
  }
  mobile.add(arm, arm2, hanging);
  group.add(mobile);

  group.userData = { baby, blanket, mobile, hanging };
  return group;
}

export function createFox() {
  const group = new THREE.Group();
  const orange = '#e8854e';
  const dark = '#b75a34';
  const cream = '#ffd9aa';
  const body = rounded(0.44, 0.42, 1.1, orange, 0.17);
  body.position.y = 0.42;
  const chest = rounded(0.36, 0.28, 0.4, cream, 0.1);
  chest.position.set(0, 0.4, 0.42);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.58);
  const skull = rounded(0.4, 0.35, 0.38, orange, 0.12);
  const snout = rounded(0.18, 0.15, 0.28, cream, 0.06);
  snout.position.set(0, -0.05, 0.25);
  const nose = sphere(0.055, '#2b2233', { widthSeg: 6, heightSeg: 4 });
  nose.position.set(0, -0.07, 0.4);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), mat(dark));
  earL.position.set(-0.15, 0.24, 0.02);
  earL.rotation.z = 0.1;
  const earR = earL.clone();
  earR.position.x = 0.15;
  earR.rotation.z = -0.1;
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#201a2d' });
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 5, 4), eyeMat);
    eye.position.set(x, 0.07, 0.205);
    head.add(eye);
  }
  head.add(skull, snout, nose, earL, earR);

  const tail = new THREE.Group();
  tail.position.set(0, 0.46, -0.54);
  const tail1 = rounded(0.26, 0.25, 0.65, dark, 0.1);
  tail1.position.z = -0.24;
  tail1.rotation.x = -0.4;
  const tailTip = rounded(0.24, 0.22, 0.26, cream, 0.09);
  tailTip.position.set(0, 0.12, -0.58);
  tail.add(tail1, tailTip);

  const legs = [];
  for (const x of [-0.18, 0.18]) {
    for (const z of [-0.38, 0.35]) {
      const leg = rounded(0.12, 0.34, 0.14, dark, 0.04);
      leg.position.set(x, 0.15, z);
      legs.push(leg);
      group.add(leg);
    }
  }
  group.add(body, chest, head, tail);
  group.userData = { head, tail, legs };
  group.scale.setScalar(0.9);
  return group;
}

export function makeIconTexture(iconName, bg = '#fff6df', border = '#281f3d', size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  const pad = Math.round(size * 0.06);
  ctx.fillStyle = border;
  roundRect(ctx, pad, pad, size - pad * 2, size - pad * 2, size * 0.2);
  ctx.fill();
  ctx.fillStyle = bg;
  roundRect(ctx, pad + 3, pad + 3, size - (pad + 3) * 2, size - (pad + 3) * 2, size * 0.17);
  ctx.fill();
  const icon = getIconCanvas(iconName);
  const iconPad = Math.round(size * 0.22);
  ctx.drawImage(icon, iconPad, iconPad, size - iconPad * 2, size - iconPad * 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function makeIconSprite(iconName, opts = {}) {
  const texture = makeIconTexture(iconName, opts.bg || '#fff6df', opts.border || '#281f3d', opts.size || 96);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
  );
  sprite.scale.set(opts.scale || 0.68, opts.scale || 0.68, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function makeSign(text, bg = '#f0c987', fg = '#392745', width = 256, height = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  roundRect(ctx, 4, 4, width - 8, height - 8, 18);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#3a2a32';
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = `${Math.round(height * 0.34)}px Bungee, Arial Black, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width / 100, height / 100), material);
  plane.castShadow = true;
  return plane;
}

export function makeNameTag(text, color = '#fff6df') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  roundRect(ctx, 4, 4, 252, 88, 18);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#3a2a32';
  ctx.stroke();
  ctx.fillStyle = '#392745';
  ctx.font = '38px Bungee, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 128, 51);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false })
  );
  sprite.scale.set(0.92, 0.345, 1);
  sprite.renderOrder = 15;
  return sprite;
}

export function createSnowman() {
  const g = new THREE.Group();
  const s1 = sphere(0.5, '#f2f5f7', { widthSeg: 8, heightSeg: 6 });
  s1.position.y = 0.5;
  const s2 = sphere(0.36, '#f7fafc', { widthSeg: 8, heightSeg: 6 });
  s2.position.y = 1.14;
  const s3 = sphere(0.25, '#f7fafc', { widthSeg: 8, heightSeg: 6 });
  s3.position.y = 1.6;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 5), mat('#f28c45'));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.59, 0.28);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#28213a' });
  for (const x of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), eyeMat);
    eye.position.set(x, 1.68, 0.21);
    g.add(eye);
  }
  const hat = cyl(0.3, 0.34, 0.12, 8, '#3d3158');
  hat.position.y = 1.83;
  const hatTop = cyl(0.22, 0.26, 0.4, 8, '#3d3158');
  hatTop.position.y = 2.04;
  const scarf = cyl(0.28, 0.29, 0.12, 8, '#e84a5f');
  scarf.position.y = 1.38;
  const armL = tubeBetween([-0.25, 1.18, 0], [-0.65, 1.44, 0.03], 0.025, '#7c5b3e', 4);
  const armR = tubeBetween([0.25, 1.18, 0], [0.65, 1.35, -0.02], 0.025, '#7c5b3e', 4);
  g.add(s1, s2, s3, nose, hat, hatTop, scarf, armL, armR);
  return g;
}

export function createPine(height = 3, tint = '#2f6e63') {
  const g = new THREE.Group();
  const trunk = cyl(0.12, 0.18, height * 0.34, 6, '#6c4b3b');
  trunk.position.y = height * 0.17;
  g.add(trunk);
  for (let i = 0; i < 3; i += 1) {
    const layer = cone(height * (0.3 - i * 0.055), height * (0.42 - i * 0.06), 7, tint);
    layer.position.y = height * (0.34 + i * 0.21);
    g.add(layer);
    const snow = cone(height * (0.18 - i * 0.035), height * (0.14 - i * 0.02), 7, '#eaf2f7');
    snow.position.y = height * (0.46 + i * 0.21);
    g.add(snow);
  }
  return g;
}

export function createBirch(height = 4) {
  const g = new THREE.Group();
  const trunk = cyl(0.12, 0.18, height, 7, '#e7e2d8');
  trunk.position.y = height / 2;
  g.add(trunk);
  const marks = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const mark = box(0.24, 0.06, 0.02, '#3d3a48');
    mark.position.set(0.02 * (i % 2), 0.5 + i * (height / 8), 0.13);
    mark.rotation.z = 0.1 * (i % 2 ? 1 : -1);
    marks.add(mark);
  }
  g.add(marks);
  const foliage = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const blob = sphere(0.55 + (i % 2) * 0.2, i % 2 ? '#7b9b5e' : '#6b8f60', { widthSeg: 7, heightSeg: 5 });
    blob.position.set(Math.sin(i * 1.7) * 0.45, height * 0.78 + i * 0.18, Math.cos(i * 2.1) * 0.35);
    foliage.add(blob);
  }
  g.add(foliage);
  return g;
}
