// 문제 생성기(3단계).
// 랜덤 모형을 먼저 만들고 그 평면도를 문제로 내므로 해가 반드시 존재한다.
// 같은 난이도와 seed면 항상 같은 문제가 나온다(공유·재도전용).
// 불가능한 문제는 솔버(4단계)가 있어야 만들 수 있어 아직 생성하지 않는다.

import { COLOR_COUNT, createModel, countColors, totalBlocks } from './model.js';
import { puzzleFromModel } from './puzzles.js';

export const DIFFICULTIES = {
  easy: { label: '쉬움', size: 3, height: 3, colors: 3, minBlocks: 6, maxBlocks: 10, fill: 0.6 },
  normal: { label: '보통', size: 4, height: 3, colors: 4, minBlocks: 12, maxBlocks: 20, fill: 0.65 },
  hard: { label: '어려움', size: 5, height: 3, colors: 6, minBlocks: 22, maxBlocks: 36, fill: 0.65 },
};

const MAX_ATTEMPTS = 1000;

/** 32비트 seed로 재현 가능한 난수 생성기(mulberry32). 0 이상 1 미만을 돌려준다. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 0x100000000) >>> 0;
}

// seed는 짧은 36진수 코드로 보여준다. 예: 2847193 → "1p0qp"
export function encodeSeed(seed) {
  return seed.toString(36);
}

export function decodeSeed(code) {
  if (typeof code !== 'string' || !/^[0-9a-z]+$/.test(code)) return null;
  const seed = parseInt(code, 36);
  return seed >= 0 && seed <= 0xffffffff ? seed : null;
}

/** 여섯 색 중 count개를 무작위로 고른다. */
function pickColors(rng, count) {
  const colors = Array.from({ length: COLOR_COUNT }, (_, i) => i + 1);
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors.slice(0, count);
}

/** 조건에 맞는지 아직 검사하지 않은 랜덤 모형 하나. */
export function generateModel(rng, { size, height, colors, fill }) {
  const palette = pickColors(rng, colors);
  const model = createModel(size, height);
  model.columns = model.columns.map(() => {
    if (rng() >= fill) return [];
    const stackHeight = 1 + Math.floor(rng() ** 1.5 * height); // 낮은 기둥이 더 흔하게
    return Array.from({ length: stackHeight }, () => palette[Math.floor(rng() * palette.length)]);
  });
  return { model, palette };
}

function isAcceptable(model, palette, options) {
  const blocks = totalBlocks(model);
  if (blocks < options.minBlocks || blocks > options.maxBlocks) return false;
  const counts = countColors(model);
  if (palette.some((color) => counts[color] === 0)) return false; // 고른 색은 모두 써야 팔레트가 의미 있다
  if (options.height > 1 && !model.columns.some((column) => column.length >= 2)) return false; // 한 층짜리 제외
  return true;
}

export function generatePuzzle(difficulty, seed = randomSeed()) {
  const options = DIFFICULTIES[difficulty];
  if (!options) throw new Error(`알 수 없는 난이도: ${difficulty}`);
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { model, palette } = generateModel(rng, options);
    if (isAcceptable(model, palette, options)) {
      return { ...puzzleFromModel(`${difficulty}-${encodeSeed(seed)}`, model), difficulty, seed };
    }
  }
  throw new Error(`문제 생성 실패(${difficulty}, seed ${seed}): 조건을 만족하는 모형을 찾지 못함`);
}
