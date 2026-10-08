import { state, subscribe, actions, isGenerated } from './game/state.js';
import { decodeSeed, encodeSeed } from './core/generator.js';
import { createScene } from './ui/scene.js';
import { initPanels } from './ui/panels.js';

// 주소의 ?mode=normal&seed=1p0qp 로 특정 생성 문제를 바로 열 수 있다.
const params = new URLSearchParams(location.search);
actions.start({ mode: params.get('mode') ?? undefined, seed: decodeSeed(params.get('seed') ?? '') ?? undefined });

// 생성 문제가 바뀔 때마다 주소를 맞춰 두면 새로고침해도 같은 문제가 유지되고 링크로 공유할 수 있다.
let syncedPuzzle = null;
subscribe(() => {
  if (state.puzzle === syncedPuzzle) return;
  syncedPuzzle = state.puzzle;
  const query = isGenerated() ? `?mode=${state.mode}&seed=${encodeSeed(state.puzzle.seed)}` : '';
  history.replaceState(null, '', location.pathname + query);
});

const scene = createScene(document.getElementById('scene'));
initPanels({ onCamera: scene.setCamera });
