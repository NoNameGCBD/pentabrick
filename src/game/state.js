// 게임 상태(문제 진행, 편집 중인 모형, 실행 취소, 점수, 시간).
// UI는 subscribe로 변경을 받아 다시 그린다.

import { createModel, placeBlock, removeBlock, paintBlock, cellAt, countColors, totalBlocks } from '../core/model.js';
import { scoreSubmit, scoreImpossible } from '../core/judge.js';
import { PUZZLES } from '../core/puzzles.js';
import { DIFFICULTIES, generatePuzzle, randomSeed } from '../core/generator.js';

export const SAMPLE_MODE = 'sample';

export const state = {
  mode: SAMPLE_MODE, // 'sample' | DIFFICULTIES의 키
  puzzleIndex: 0, // 샘플 모드에서의 순번
  puzzle: null,
  model: null,
  past: [],
  future: [],
  color: 1,
  tool: 'place', // 'place' | 'paint' | 'erase'
  score: 0,
  phase: 'playing', // 'playing' | 'result'
  result: null,
  startedAt: 0,
  showMine: true,
  showingAnswer: false,
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(state);
}

export function isGenerated() {
  return state.mode !== SAMPLE_MODE;
}

export function remaining(color) {
  return state.puzzle.counts[color] - countColors(state.model)[color];
}

export function requiredTotal() {
  return state.puzzle.counts.reduce((sum, count) => sum + count, 0);
}

export function usedTotal() {
  return totalBlocks(state.model);
}

export function elapsedMs() {
  return state.phase === 'result' ? state.result.elapsedMs : performance.now() - state.startedAt;
}

function loadPuzzle(puzzle) {
  Object.assign(state, {
    puzzle,
    model: createModel(puzzle.size, puzzle.height),
    past: [],
    future: [],
    color: puzzle.counts.findIndex((count) => count > 0),
    tool: 'place',
    phase: 'playing',
    result: null,
    startedAt: performance.now(),
    showingAnswer: false,
  });
  emit();
}

function loadSample(index) {
  state.mode = SAMPLE_MODE;
  state.puzzleIndex = index;
  loadPuzzle(PUZZLES[index]);
}

function loadGenerated(mode, seed = randomSeed()) {
  state.mode = mode;
  loadPuzzle(generatePuzzle(mode, seed));
}

function commit(next) {
  if (!next || state.phase !== 'playing') return;
  state.past.push(state.model);
  state.future = [];
  state.model = next;
  emit();
}

function finish(result) {
  state.result = { ...result, elapsedMs: performance.now() - state.startedAt };
  state.score += result.delta;
  state.phase = 'result';
  emit();
}

export const actions = {
  /** mode가 난이도면 그 난이도의 문제(seed가 있으면 그 문제)로, 아니면 샘플 1번으로 시작한다. */
  start({ mode = SAMPLE_MODE, seed } = {}) {
    state.score = 0;
    if (DIFFICULTIES[mode]) loadGenerated(mode, seed);
    else loadSample(0);
  },

  /** 모드를 바꾸면 그 모드의 새 문제가 바로 나온다. 점수는 유지한다. */
  setMode(mode) {
    if (DIFFICULTIES[mode]) loadGenerated(mode);
    else loadSample(0);
  },

  /** 현재 문제를 버리고 새 문제. */
  newPuzzle() {
    if (isGenerated()) loadGenerated(state.mode);
    else loadSample((state.puzzleIndex + 1) % PUZZLES.length);
  },

  place(x, z) {
    if (remaining(state.color) <= 0) return;
    commit(placeBlock(state.model, x, z, state.color));
  },

  paint(x, y, z) {
    if (cellAt(state.model, x, y, z) === state.color || remaining(state.color) <= 0) return;
    commit(paintBlock(state.model, x, y, z, state.color));
  },

  erase(x, y, z) {
    commit(removeBlock(state.model, x, y, z));
  },

  undo() {
    if (state.phase !== 'playing' || !state.past.length) return;
    state.future.push(state.model);
    state.model = state.past.pop();
    emit();
  },

  redo() {
    if (state.phase !== 'playing' || !state.future.length) return;
    state.past.push(state.model);
    state.model = state.future.pop();
    emit();
  },

  reset() {
    if (usedTotal() === 0) return;
    commit(createModel(state.puzzle.size, state.puzzle.height));
  },

  setColor(color) {
    if (state.puzzle.counts[color] > 0) {
      state.color = color;
      emit();
    }
  },

  setTool(tool) {
    state.tool = tool;
    emit();
  },

  setShowMine(value) {
    state.showMine = value;
    emit();
  },

  /** 규칙 4: 블록을 정확히 다 쓴 모형만 제출할 수 있다. */
  submit() {
    if (state.phase !== 'playing' || usedTotal() !== requiredTotal()) return;
    finish({ kind: 'submit', ...scoreSubmit(state.model, state.puzzle) });
  },

  /** 규칙 5 */
  declareImpossible() {
    if (state.phase !== 'playing') return;
    finish({ kind: 'impossible', ...scoreImpossible(state.puzzle) });
  },

  showAnswer() {
    if (state.phase !== 'result' || !state.puzzle.answer) return;
    state.model = state.puzzle.answer;
    state.showingAnswer = true;
    emit();
  },

  next() {
    actions.newPuzzle();
  },
};
