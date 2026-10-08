// 3D 화면 바깥의 DOM UI: 평면도 패널, 문제/블록/도구/제출 패널, 상단 상태 표시.

import { VIEW_NAMES, projectAll, viewsEqual } from '../core/projection.js';
import { PUZZLES } from '../core/puzzles.js';
import { DIFFICULTIES, encodeSeed } from '../core/generator.js';
import {
  SAMPLE_MODE, state, subscribe, actions, isGenerated, remaining, requiredTotal, usedTotal, elapsedMs,
} from '../game/state.js';
import { COLOR_INFO } from './colors.js';

const VIEW_LABELS = {
  top: ['상', '위에서 · 아래쪽이 앞'],
  front: ['전', '앞에서'],
  back: ['후', '뒤에서 · 좌우 반전'],
  left: ['좌', '왼쪽에서 · 오른쪽이 앞'],
  right: ['우', '오른쪽에서 · 왼쪽이 앞'],
};

const TOOLS = [
  ['place', '놓기', 'Q'],
  ['paint', '칠하기', 'W'],
  ['erase', '지우기', 'E'],
];

const MODES = [[SAMPLE_MODE, '샘플'], ...Object.entries(DIFFICULTIES).map(([key, { label }]) => [key, label])];

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** 상단 바에 보이는 문제 이름. 예: "샘플 2 / 6" 또는 "보통 · 1p0qp" */
function puzzleLabel() {
  return isGenerated()
    ? `${DIFFICULTIES[state.mode].label} · ${encodeSeed(state.puzzle.seed)}`
    : `샘플 ${state.puzzleIndex + 1} / ${PUZZLES.length}`;
}

function gridHtml(view) {
  const cells = view.flat().map((color) => (
    color ? `<i style="background:${COLOR_INFO[color].hex}" title="${COLOR_INFO[color].name}"></i>` : '<i class="empty"></i>'
  ));
  return `<div class="grid" style="--cols:${view[0].length}">${cells.join('')}</div>`;
}

function viewsHtml() {
  // 정답 모형을 보여주는 동안에는 연습 옵션과 상관없이 비교를 표시한다.
  const mine = state.showMine || state.showingAnswer ? projectAll(state.model) : null;
  const cards = VIEW_NAMES.map((name) => {
    const [short, hint] = VIEW_LABELS[name];
    const match = mine && viewsEqual(mine[name], state.puzzle.views[name]);
    return `
      <article class="view-card${match ? ' is-match' : ''}">
        <header>
          <b>${short}</b><span>${hint}</span>
          ${mine ? `<em>${match ? '일치' : '불일치'}</em>` : ''}
        </header>
        <div class="view-grids">
          <figure>${gridHtml(state.puzzle.views[name])}<figcaption>목표</figcaption></figure>
          ${mine ? `<figure>${gridHtml(mine[name])}<figcaption>내 모형</figcaption></figure>` : ''}
        </div>
      </article>`;
  });
  return `<h2>평면도</h2>${cards.join('')}`;
}

function puzzleSectionHtml() {
  const modes = MODES.map(([key, label]) => (
    `<button data-action="mode" data-value="${key}" class="${key === state.mode ? 'is-selected' : ''}">${label}</button>`
  ));
  const generated = isGenerated();
  return `
    <h2>문제 <small>${puzzleLabel()}</small></h2>
    <div class="segmented">${modes.join('')}</div>
    <div class="row">
      <button data-action="newPuzzle">${generated ? '새 문제' : '다음 샘플'}</button>
      <button data-action="copyLink" ${generated ? '' : 'disabled'}>링크 복사</button>
    </div>
    <p class="muted">${generated
      ? '같은 링크(난이도와 코드)를 열면 같은 문제가 나옵니다.'
      : '손으로 만든 문제 6개입니다. 난이도를 고르면 문제가 자동으로 만들어집니다.'}</p>`;
}

function paletteHtml() {
  const buttons = COLOR_INFO.map((info, color) => {
    if (!info) return '';
    const total = state.puzzle.counts[color];
    const classes = ['swatch', color === state.color ? 'is-selected' : '', total === 0 ? 'is-unused' : ''].join(' ');
    return `
      <button class="${classes}" data-action="color" data-value="${color}" ${total === 0 ? 'disabled' : ''}
              title="${info.name} (${color})">
        <i style="background:${info.hex}"></i>
        <span>${info.name}</span>
        <b>${total === 0 ? '–' : `${remaining(color)}/${total}`}</b>
      </button>`;
  });
  return `<div class="palette">${buttons.join('')}</div>`;
}

function resultHtml() {
  const { result, puzzle } = state;
  const sign = result.delta > 0 ? `+${result.delta}` : `−${Math.abs(result.delta)}`;
  let title, detail;

  if (result.kind === 'submit' && result.correct) {
    title = '정답입니다';
    detail = '다섯 평면도와 블록 수가 모두 일치합니다.';
  } else if (result.kind === 'submit') {
    title = '오답입니다';
    const wrong = VIEW_NAMES.filter((name) => !result.views[name]).map((name) => VIEW_LABELS[name][0]);
    detail = wrong.length ? `일치하지 않는 평면도: ${wrong.join(', ')}` : '색별 블록 수가 맞지 않습니다.';
    if (!puzzle.solvable) detail += ` 이 문제는 구현이 불가능한 문제였습니다. ${puzzle.reason}`;
  } else if (result.correct) {
    title = '맞습니다, 불가능한 문제입니다';
    detail = puzzle.reason;
  } else {
    title = '틀렸습니다, 구현 가능한 문제입니다';
    detail = '정답 모형을 확인해 보세요.';
  }

  return `
    <div class="result ${result.correct ? 'is-correct' : 'is-wrong'}">
      <strong>${title} <span class="delta">${sign}점</span></strong>
      <p>${detail}</p>
      <p class="muted">소요 시간 ${formatTime(result.elapsedMs)}</p>
      <div class="row">
        ${puzzle.answer && !state.showingAnswer ? '<button data-action="showAnswer">정답 모형 보기</button>' : ''}
        <button class="primary" data-action="next">다음 문제</button>
      </div>
    </div>`;
}

function submitSectionHtml() {
  const used = usedTotal(), required = requiredTotal();
  if (state.phase !== 'playing') return resultHtml();
  const hint = used === required
    ? '블록을 모두 사용했습니다. 제출할 수 있습니다.'
    : `블록을 정확히 ${required}개 모두 사용해야 제출할 수 있습니다.`;
  const generatedNote = isGenerated()
    ? '<p class="muted">자동 생성 문제는 아직 모두 구현 가능합니다. 불가능 문제 생성은 솔버(4단계)와 함께 추가됩니다.</p>'
    : '';
  return `
    <div class="row">
      <button class="primary" data-action="submit" ${used === required ? '' : 'disabled'}>정답 제출 <small>±1</small></button>
      <button class="danger" data-action="impossible">불가능 <small>±2</small></button>
    </div>
    <p class="muted">${hint}</p>
    ${generatedNote}`;
}

function controlsHtml() {
  const playing = state.phase === 'playing';
  const used = usedTotal(), required = requiredTotal();
  const tools = TOOLS.map(([tool, label, key]) => (
    `<button data-action="tool" data-value="${tool}" class="${tool === state.tool ? 'is-selected' : ''}" title="단축키 ${key}">${label}</button>`
  ));

  return `
    ${puzzleSectionHtml()}

    <h2>블록 <small>${state.showingAnswer ? '정답 모형' : `사용 ${used} / ${required}`}</small></h2>
    ${paletteHtml()}

    <h2>도구</h2>
    <div class="segmented">${tools.join('')}</div>
    <div class="row">
      <button data-action="undo" ${playing && state.past.length ? '' : 'disabled'}>실행 취소</button>
      <button data-action="redo" ${playing && state.future.length ? '' : 'disabled'}>다시 실행</button>
      <button data-action="reset" ${playing && used ? '' : 'disabled'}>초기화</button>
    </div>
    <label class="check">
      <input type="checkbox" data-action="showMine" ${state.showMine ? 'checked' : ''}>
      내 모형의 평면도 표시 (연습용)
    </label>

    <h2>제출</h2>
    ${submitSectionHtml()}

    <h2>조작법</h2>
    <ul class="help">
      <li>칸이나 블록을 클릭하면 그 칸 맨 위에 블록이 쌓입니다.</li>
      <li>우클릭 또는 지우기 도구로 블록을 지웁니다. 위 블록은 내려옵니다.</li>
      <li>드래그로 회전, 휠로 확대/축소합니다.</li>
      <li>숫자 1–6으로 색 선택, Ctrl/⌘+Z로 실행 취소.</li>
    </ul>`;
}

async function copyLink(button) {
  try {
    await navigator.clipboard.writeText(location.href);
    button.textContent = '복사됨';
  } catch {
    button.textContent = '복사 실패';
  }
  setTimeout(() => { button.textContent = '링크 복사'; }, 1500);
}

export function initPanels({ onCamera }) {
  const viewsPanel = document.getElementById('views-panel');
  const controlsPanel = document.getElementById('controls-panel');
  const statPuzzle = document.getElementById('stat-puzzle');
  const statScore = document.getElementById('stat-score');
  const statTime = document.getElementById('stat-time');

  function render() {
    viewsPanel.innerHTML = viewsHtml();
    controlsPanel.innerHTML = controlsHtml();
    const { size, height } = state.puzzle;
    statPuzzle.textContent = `${puzzleLabel()} (${size}×${size}×${height})`;
    statScore.textContent = state.score;
    statTime.textContent = formatTime(elapsedMs());
  }

  controlsPanel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const { action, value } = button.dataset;
    if (action === 'color') actions.setColor(Number(value));
    else if (action === 'tool') actions.setTool(value);
    else if (action === 'mode') actions.setMode(value);
    else if (action === 'impossible') actions.declareImpossible();
    else if (action === 'copyLink') copyLink(button);
    else actions[action]();
  });

  controlsPanel.addEventListener('change', (event) => {
    if (event.target.dataset.action === 'showMine') actions.setShowMine(event.target.checked);
  });

  document.getElementById('camera-bar').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-camera]');
    if (button) onCamera(button.dataset.camera);
  });

  window.addEventListener('keydown', (event) => {
    if (event.target.matches?.('input, textarea')) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) actions.redo();
      else actions.undo();
    } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      actions.redo();
    } else if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    } else if (key >= '1' && key <= '6') {
      actions.setColor(Number(key));
    } else {
      const tool = TOOLS.find(([, , shortcut]) => shortcut.toLowerCase() === key);
      if (tool) actions.setTool(tool[0]);
    }
  });

  setInterval(() => {
    statTime.textContent = formatTime(elapsedMs());
  }, 250);

  subscribe(render);
  render();
}
