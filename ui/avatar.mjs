import * as THREE from 'three';

const canvas = document.getElementById('robot-canvas');
try {
  createAvatar(canvas);
} catch (error) {
  console.warn('WebGL avatar unavailable', error);
}

function createAvatar(surface) {
  const renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  camera.position.set(0, .12, 6.2);
  camera.lookAt(0, -.04, 0);

  const key = new THREE.DirectionalLight(0xd9ebff, 4);
  key.position.set(-3, 4, 5);
  scene.add(key, new THREE.HemisphereLight(0xc4eaff, 0x17202b, 1.9));
  const rim = new THREE.DirectionalLight(0x38baff, 3.1);
  rim.position.set(4, 1, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffb98b, 1.25);
  fill.position.set(2, -2, 4);
  scene.add(fill);

  const titanium = new THREE.MeshStandardMaterial({ color: 0x9aaebe, metalness: .53, roughness: .31 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x435566, metalness: .43, roughness: .39 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x17232c, metalness: .4, roughness: .38 });
  const black = new THREE.MeshStandardMaterial({ color: 0x080d12, metalness: .24, roughness: .29 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x143445, metalness: .32, roughness: .2 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x73d8ff, emissive: 0x1cb5f9, emissiveIntensity: 2.65, roughness: .3 });
  const pale = new THREE.MeshBasicMaterial({ color: 0xd5f8ff });

  const bust = new THREE.Group();
  scene.add(bust);
  const head = new THREE.Group();
  bust.add(head);

  function mesh(parent, geometry, material, x, y, z) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  }

  function ball(parent, material, x, y, z, a, b, c) {
    const item = mesh(parent, new THREE.SphereGeometry(1, 36, 24), material, x, y, z);
    item.scale.set(a, b, c);
    return item;
  }

  function plate(parent, material, vertices, z, depth = .12, bevel = .045) {
    const shape = new THREE.Shape();
    shape.moveTo(...vertices[0]);
    for (const point of vertices.slice(1)) shape.lineTo(...point);
    shape.closePath();
    return mesh(parent, new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
      bevelSegments: 3, steps: 1,
    }), material, 0, 0, z);
  }

  function ring(parent, material, x, y, z, radius, thickness) {
    return mesh(parent, new THREE.TorusGeometry(radius, thickness, 12, 48), material, x, y, z);
  }

  function piston(parent, material, start, end, radius) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const center = a.clone().lerp(b, .5);
    const item = mesh(parent, new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 18), material, ...center.toArray());
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return item;
  }

  ball(head, graphite, 0, .31, -.15, .96, 1.1, .74);
  ball(head, ceramic, 0, .73, -.22, .89, .73, .72);
  ball(head, black, 0, .09, .16, .79, .79, .56);
  plate(head, titanium, [[-.76,.45],[-.61,.94],[-.3,1.14],[.3,1.14],[.61,.94],[.76,.45],[.49,.37],[0,.51],[-.49,.37]], .38, .24);
  plate(head, ceramic, [[-.29,.88],[-.19,1.19],[.19,1.19],[.29,.88],[.17,.62],[-.17,.62]], .63, .07, .025);
  plate(head, graphite, [[-.05,.68],[-.036,1.09],[.036,1.09],[.05,.68]], .719, .016, .008);
  plate(head, cyan, [[-.012,.82],[-.012,1.03],[.012,1.03],[.012,.82]], .746, .007, .004);

  const optics = [];
  for (const side of [-1, 1]) {
    const mirror = points => points.map(([x, y]) => [x * side, y]);
    plate(head, graphite, mirror([[.08,.37],[.68,.49],[.81,.25],[.63,.07],[.19,.07]]), .57, .13);
    plate(head, lens, mirror([[.12,.31],[.71,.41],[.69,.22],[.53,.135],[.21,.15]]), .73, .062, .028);
    const light = new THREE.Group();
    light.position.y = .25;
    head.add(light);
    optics.push(light);
    plate(light, cyan, mirror([[.16,-.019],[.649,.071],[.62,-.005],[.22,-.058]]), .818, .022, .012);
    plate(light, pale, mirror([[.25,-.019],[.58,.041],[.55,.013],[.28,-.034]]), .852, .006, .005);

    const temple = mesh(head, new THREE.CylinderGeometry(.26,.28,.2,40), graphite, side * .91,.15,-.04);
    temple.rotation.z = Math.PI / 2;
    const ear = ring(head, titanium, side * 1.01,.15,-.04,.203,.042);
    ear.rotation.y = Math.PI / 2;
    const earLight = ring(head, cyan, side * 1.045,.15,-.04,.147,.01);
    earLight.rotation.y = Math.PI / 2;

    plate(head, titanium, mirror([[.79,.15],[.52,.03],[.26,-.19],[.36,-.4],[.65,-.3],[.86,-.04]]), .49, .22);
    plate(head, ceramic, mirror([[.63,-.12],[.51,-.16],[.37,-.31],[.46,-.35],[.64,-.25]]), .74,.035,.02);
    for (let i = 0; i < 3; i++) {
      piston(head, graphite, [side * (.49 + i * .062), -.18 + i * .022, .79], [side * (.46 + i * .062), -.262 + i * .022, .79], .015);
    }
    piston(head, titanium, [side * .73,-.1,.35], [side * .43,-.67,.38], .033);
    piston(head, graphite, [side * .69,-.17,.43], [side * .39,-.65,.49], .051);
  }

  plate(head, titanium, [[-.1,.25],[.1,.25],[.2,-.12],[.08,-.24],[-.08,-.24],[-.2,-.12]], .62,.18,.024);
  ball(head, black, 0,-.39,.54,.48,.25,.23);
  plate(head, graphite, [[-.34,-.29],[.34,-.29],[.27,-.39],[-.27,-.39]], .758,.075,.018);
  const jaw = new THREE.Group();
  jaw.position.set(0,-.37,.04);
  head.add(jaw);
  plate(jaw, titanium, [[-.39,-.05],[-.24,-.32],[.24,-.32],[.39,-.05],[.25,-.024],[-.25,-.024]], .48,.22);
  plate(jaw, ceramic, [[-.21,-.14],[-.14,-.28],[.14,-.28],[.21,-.14]], .715,.045,.024);
  const aperture = ball(head, cyan, 0,-.394,.751,.244,.034,.028);
  for (let i = -4; i <= 4; i++) {
    piston(jaw, graphite, [i * .067,-.067,.757], [i * .067,-.109,.757], .014);
  }

  piston(bust, graphite, [0,-1.32,-.1], [0,-.64,-.1], .33);
  for (let i = 0; i < 7; i++) {
    const coupling = ring(bust, i === 3 ? cyan : ceramic, 0,-.79-i*.056,-.1,.30,.024);
    coupling.rotation.x = Math.PI / 2;
  }
  ball(bust, graphite, 0,-1.43,-.12,1.28,.35,.56);
  ball(bust, ceramic, 0,-1.46,.04,.94,.22,.52);

  const rect = () => surface.getBoundingClientRect();
  const resize = () => {
    const { width, height } = rect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(surface);
  resize();
  surface.closest('.stage').classList.add('has-webgl');

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let level = 0;
  let signal = 0;
  let gaze = 0.12;
  const stage = surface.closest('.stage');
  stage.addEventListener('pointermove', event => {
    const bounds = rect();
    gaze = Math.max(-.36, Math.min(.36, (event.clientX - bounds.left - bounds.width / 2) / bounds.width));
  });
  stage.addEventListener('pointerleave', () => { gaze = .12; });
  window.mithraAvatar = amplitude => { signal = THREE.MathUtils.clamp(amplitude || 0, 0, 1); };
  renderer.setAnimationLoop(milliseconds => {
    const t = milliseconds / 1000;
    level = THREE.MathUtils.lerp(level, signal, .28);
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, gaze + (reducedMotion ? 0 : Math.sin(t * .67) * .045), .055);
    head.rotation.x = reducedMotion ? 0 : -.045 + Math.sin(t * 1.35) * .026;
    head.position.y = reducedMotion ? 0 : Math.sin(t * 1.55) * .021;
    jaw.position.y = -.37 - level * .115;
    jaw.rotation.x = -level * .14;
    aperture.scale.y = .017 + level * .052;
    cyan.emissiveIntensity = 2.3 + level * 1.3;
    const blink = reducedMotion ? 1 : 1 - .91 * Math.exp(-Math.pow(((t + 1) % 5.8 - 5.48) * 25, 2));
    for (const eye of optics) eye.scale.y = blink;
    renderer.render(scene, camera);
  });
}
