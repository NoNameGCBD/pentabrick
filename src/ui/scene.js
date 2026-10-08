// 3D 블록 에디터. 상태를 구독해 장면을 다시 만들고, 클릭을 편집 액션으로 바꾼다.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getColumn } from '../core/model.js';
import { state, subscribe, actions, remaining } from '../game/state.js';
import { COLOR_INFO } from './colors.js';

const CLICK_TOLERANCE_PX = 5; // 이보다 많이 움직이면 클릭이 아니라 카메라 회전으로 본다
const BASE_FOV = 40;
const MIN_ASPECT = 1.25; // 화면 가로세로비가 이보다 작으면 시야각을 넓힌다

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const dom = renderer.domElement;
  container.appendChild(dom);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 100);
  const controls = new OrbitControls(camera, dom);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2; // 바닥 아래로는 못 본다(하 평면도는 없음)

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(3, 8, 5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-4, 3, -6);
  scene.add(fill);

  // 공유 지오메트리/머티리얼
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1f2430, transparent: true, opacity: 0.6 });
  const blockMats = COLOR_INFO.map((info) => info && new THREE.MeshLambertMaterial({
    color: info.hex, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
  const ghostMats = COLOR_INFO.map((info) => info && new THREE.MeshLambertMaterial({
    color: info.hex, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  const eraseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  const tileGeo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
  const tileMat = new THREE.MeshBasicMaterial({ color: 0xd9dee7 });

  const boardGroup = new THREE.Group();
  const blocksGroup = new THREE.Group();
  scene.add(boardGroup, blocksGroup);

  // 놓기 미리보기(ghost)와 칠하기/지우기 대상 표시(marker)
  const ghost = new THREE.Mesh(boxGeo, ghostMats[1]);
  const marker = new THREE.Mesh(boxGeo, eraseMat);
  marker.scale.setScalar(1.04);
  ghost.visible = marker.visible = false;
  scene.add(ghost, marker);

  let pickables = [];
  let tiles = [];

  function worldPosition(x, y, z) {
    const offset = (state.puzzle.size - 1) / 2;
    return new THREE.Vector3(x - offset, y + 0.5, z - offset);
  }

  function makeLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '700 64px system-ui, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5b6474';
    ctx.fillText(text, 128, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(0.8, 0.4, 1);
    return sprite;
  }

  function buildBoard() {
    for (const child of boardGroup.children) child.material.map?.dispose();
    boardGroup.clear();
    tiles = [];
    const n = state.puzzle.size;
    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) {
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.position.copy(worldPosition(x, -0.5, z));
        tile.userData = { kind: 'tile', x, z };
        boardGroup.add(tile);
        tiles.push(tile);
      }
    }
    const edge = n / 2 + 0.6;
    const labels = [['앞', 0, edge], ['뒤', 0, -edge], ['좌', -edge, 0], ['우', edge, 0]];
    for (const [text, x, z] of labels) {
      const label = makeLabel(text);
      label.position.set(x, 0.05, z);
      boardGroup.add(label);
    }
  }

  function buildBlocks() {
    blocksGroup.clear();
    const blocks = [];
    const { size: n } = state.model;
    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) {
        getColumn(state.model, x, z).forEach((color, y) => {
          const block = new THREE.Mesh(boxGeo, blockMats[color]);
          block.position.copy(worldPosition(x, y, z));
          block.userData = { kind: 'block', x, y, z };
          block.add(new THREE.LineSegments(edgeGeo, edgeMat));
          blocksGroup.add(block);
          blocks.push(block);
        });
      }
    }
    pickables = [...tiles, ...blocks];
  }

  function setCamera(name) {
    const { size: n, height: h } = state.puzzle;
    const distance = Math.max(n, h) * 3.1;
    const targetY = name === 'top' ? 0 : h * 0.3;
    const position = {
      home: [n * 1.15, h * 1.45, n * 2.05],
      top: [0, distance, 0.001], // 화면 아래쪽이 앞이 되도록 살짝 앞으로 기울임
      front: [0, targetY, distance],
      back: [0, targetY, -distance],
      left: [-distance, targetY, 0],
      right: [distance, targetY, 0],
    }[name];
    camera.position.set(...position);
    controls.target.set(0, targetY, 0);
    controls.update();
  }

  // --- 마우스/터치 ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lastPointer = null; // 마지막 포인터 위치(모형이 바뀐 뒤 미리보기를 갱신하는 데 사용)
  let pointerDown = null;
  let hover = null;

  function pick(clientX, clientY) {
    const rect = dom.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    // 다음 프레임이 그려지기 전에 클릭해도 정확히 집히도록 행렬을 직접 갱신한다.
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    return hits.length ? hits[0].object.userData : null;
  }

  function refreshHover() {
    hover = lastPointer && state.phase === 'playing' ? pick(lastPointer.x, lastPointer.y) : null;
    ghost.visible = marker.visible = false;
    dom.style.cursor = hover ? 'pointer' : 'grab';
    if (!hover) return;

    if (state.tool === 'place') {
      const height = getColumn(state.model, hover.x, hover.z).length;
      if (height >= state.model.height || remaining(state.color) <= 0) return;
      ghost.material = ghostMats[state.color];
      ghost.position.copy(worldPosition(hover.x, height, hover.z));
      ghost.visible = true;
    } else if (hover.kind === 'block') {
      marker.material = state.tool === 'erase' ? eraseMat : ghostMats[state.color];
      marker.position.copy(worldPosition(hover.x, hover.y, hover.z));
      marker.visible = true;
    }
  }

  dom.addEventListener('pointermove', (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
    if (!pointerDown) refreshHover();
  });

  dom.addEventListener('pointerleave', () => {
    lastPointer = null;
    refreshHover();
  });

  dom.addEventListener('pointerdown', (event) => {
    pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
  });

  dom.addEventListener('pointerup', (event) => {
    const down = pointerDown;
    pointerDown = null;
    if (!down || state.phase !== 'playing') return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_TOLERANCE_PX) return;

    const target = pick(event.clientX, event.clientY);
    if (!target) return;
    const tool = down.button === 2 ? 'erase' : state.tool; // 우클릭은 항상 지우기
    if (tool === 'place') actions.place(target.x, target.z);
    else if (target.kind !== 'block') return;
    else if (tool === 'paint') actions.paint(target.x, target.y, target.z);
    else actions.erase(target.x, target.y, target.z);
  });

  dom.addEventListener('pointercancel', () => {
    pointerDown = null;
  });

  dom.addEventListener('contextmenu', (event) => event.preventDefault());

  // --- 상태 동기화 ---
  let builtPuzzle = null;
  let builtModel = null;

  function sync() {
    if (state.puzzle !== builtPuzzle) {
      builtPuzzle = state.puzzle;
      buildBoard();
      setCamera('home');
    }
    if (state.model !== builtModel) {
      builtModel = state.model;
      buildBlocks();
    }
    refreshHover();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // 세로로 긴 화면에서는 시야각을 넓혀 판이 좌우로 잘리지 않게 한다.
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * Math.max(1, MIN_ASPECT / camera.aspect));
    camera.fov = THREE.MathUtils.radToDeg(halfFov) * 2;
    camera.updateProjectionMatrix();
  }

  resize();
  new ResizeObserver(resize).observe(container);
  subscribe(sync);
  sync();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { setCamera };
}
