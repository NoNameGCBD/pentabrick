// 정답 판정과 점수.
// 원본 모형과 비교하지 않는다: 같은 평면도를 만드는 모형이 여러 개일 수 있으므로
// "다섯 평면도가 모두 일치" + "색별 블록 수를 정확히 사용"만 검사한다.

import { countColors } from './model.js';
import { VIEW_NAMES, projectAll, viewsEqual } from './projection.js';

export const SUBMIT_POINTS = 1; // 규칙 4
export const IMPOSSIBLE_POINTS = 2; // 규칙 5

export function judge(model, puzzle) {
  const mine = projectAll(model);
  const views = {};
  for (const name of VIEW_NAMES) views[name] = viewsEqual(mine[name], puzzle.views[name]);

  const used = countColors(model);
  const countsMatch = puzzle.counts.every((count, color) => used[color] === count);

  const correct = countsMatch && VIEW_NAMES.every((name) => views[name]);
  return { correct, views, countsMatch };
}

/** 모형 제출: 정답이면 +1, 아니면 -1. */
export function scoreSubmit(model, puzzle) {
  const result = judge(model, puzzle);
  return { ...result, delta: result.correct ? SUBMIT_POINTS : -SUBMIT_POINTS };
}

/** 불가능 선언: 실제로 해가 없으면 +2, 해가 있으면 -2. */
export function scoreImpossible(puzzle) {
  const correct = !puzzle.solvable;
  return { correct, delta: correct ? IMPOSSIBLE_POINTS : -IMPOSSIBLE_POINTS };
}
