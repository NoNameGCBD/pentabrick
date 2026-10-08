// 핵심 로직 단위 테스트. 빌드 도구 없이 두 가지 방법으로 실행한다.
//   브라우저: tests/index.html 열기
//   macOS 터미널: jsc -m tests/core.test.js  (jsc는 JavaScriptCore에 포함)

import {
  EMPTY, COLOR_COUNT, createModel, parseModel, placeBlock, removeBlock, paintBlock,
  cellAt, getColumn, countColors, totalBlocks,
} from '../src/core/model.js';
import {
  projectTop, projectFront, projectBack, projectLeft, projectRight, projectAll,
} from '../src/core/projection.js';
import { judge, scoreSubmit, scoreImpossible } from '../src/core/judge.js';
import { PUZZLES, puzzleFromModel } from '../src/core/puzzles.js';
import { DIFFICULTIES, generatePuzzle, mulberry32, encodeSeed, decodeSeed } from '../src/core/generator.js';

const R = 1, O = 2, Y = 3, G = 4, B = 5, P = 6, _ = EMPTY;

// --- 아주 작은 테스트 도구 ---
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error.message });
  }
}
function assert(condition, message = '조건이 거짓') {
  if (!condition) throw new Error(message);
}
function assertEqual(actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`기대값 ${e}, 실제값 ${a}`);
}

// 전수 탐색으로 해가 있는지 확인한다(테스트 전용, 작은 문제에만 사용).
function hasSolution(puzzle) {
  const { size: n, height: h, views, counts } = puzzle;
  const remaining = counts.slice();
  const model = createModel(n, h);
  const silhouette = (view, col) => {
    for (let row = 0; row < h; row++) if (view[row][col] !== EMPTY) return h - row;
    return 0;
  };

  function fill(index) {
    if (index === n * n) return remaining.every((count) => count === 0) && judge(model, puzzle).correct;
    const x = index % n, z = Math.floor(index / n);
    const topColor = views.top[z][x];
    if (topColor === EMPTY) return fill(index + 1);
    const limit = Math.min(silhouette(views.front, x), silhouette(views.left, z));

    function grow(stack) {
      if (stack.length < limit && remaining[topColor] > 0) {
        remaining[topColor]--;
        model.columns[index] = [...stack, topColor];
        if (fill(index + 1)) return true;
        remaining[topColor]++;
      }
      if (stack.length + 1 < limit) {
        for (let color = 1; color <= COLOR_COUNT; color++) {
          if (remaining[color] === 0) continue;
          remaining[color]--;
          if (grow([...stack, color])) return true;
          remaining[color]++;
        }
      }
      return false;
    }

    const found = grow([]);
    if (!found) model.columns[index] = [];
    return found;
  }
  return fill(0);
}

// --- 모형 ---
test('빈 모형의 평면도는 모두 비어 있다', () => {
  const views = projectAll(createModel(3));
  for (const view of Object.values(views)) assert(view.flat().every((cell) => cell === EMPTY));
  assertEqual([views.top.length, views.top[0].length, views.front.length, views.front[0].length], [3, 3, 3, 3]);
});

test('placeBlock은 칸의 맨 위에 쌓고 원본을 바꾸지 않는다', () => {
  const empty = createModel(3);
  const one = placeBlock(empty, 1, 2, R);
  const two = placeBlock(one, 1, 2, B);
  assertEqual(getColumn(two, 1, 2), [R, B]);
  assertEqual(getColumn(one, 1, 2), [R]);
  assertEqual(totalBlocks(empty), 0);
});

test('placeBlock은 최대 높이, 격자 밖, 잘못된 색을 거부한다', () => {
  let model = createModel(2, 2);
  model = placeBlock(placeBlock(model, 0, 0, R), 0, 0, R);
  assertEqual(placeBlock(model, 0, 0, R), null);
  assertEqual(placeBlock(model, 2, 0, R), null);
  assertEqual(placeBlock(model, 0, -1, R), null);
  assertEqual(placeBlock(model, 1, 1, 7), null);
  assertEqual(placeBlock(model, 1, 1, 0), null);
});

test('removeBlock은 위 블록을 아래로 내린다', () => {
  const model = parseModel(['RGB .', '. .'], 3);
  assertEqual(getColumn(removeBlock(model, 0, 0, 0), 0, 0), [G, B]);
  assertEqual(getColumn(removeBlock(model, 0, 1, 0), 0, 0), [R, B]);
  assertEqual(removeBlock(model, 0, 3, 0), null);
  assertEqual(removeBlock(model, 1, 0, 0), null);
});

test('paintBlock은 한 블록의 색만 바꾼다', () => {
  const model = parseModel(['RGB .', '. .'], 3);
  assertEqual(getColumn(paintBlock(model, 0, 1, 0, Y), 0, 0), [R, Y, B]);
  assertEqual(paintBlock(model, 0, 1, 0, G), null);
  assertEqual(paintBlock(model, 1, 0, 0, G), null);
});

test('countColors는 색별 개수를 센다', () => {
  const model = parseModel(['RR B', 'P RG']);
  assertEqual(countColors(model), [0, 3, 0, 0, 1, 1, 1]);
  assertEqual(totalBlocks(model), 6);
});

test('어떤 순서로 편집해도 공중에 뜬 블록이 생기지 않는다', () => {
  let model = createModel(3);
  let seed = 12345;
  const rand = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  for (let step = 0; step < 500; step++) {
    const x = rand(3), z = rand(3);
    const next = rand(3) === 0
      ? removeBlock(model, x, rand(3), z)
      : placeBlock(model, x, z, 1 + rand(COLOR_COUNT));
    if (next) model = next;
    for (let cx = 0; cx < 3; cx++) for (let cz = 0; cz < 3; cz++) {
      const height = getColumn(model, cx, cz).length;
      for (let y = 0; y < 3; y++) {
        assert((cellAt(model, cx, y, cz) !== EMPTY) === (y < height), '빈칸 위에 블록이 있음');
      }
    }
  }
});

// --- 평면도 ---
test('방향 확인: 뒤-왼쪽 구석(x=0, z=0)의 블록 하나', () => {
  const model = parseModel(['R . .', '. . .', '. . .']);
  assertEqual(projectTop(model), [[R, _, _], [_, _, _], [_, _, _]]);
  assertEqual(projectFront(model), [[_, _, _], [_, _, _], [R, _, _]]);
  assertEqual(projectBack(model), [[_, _, _], [_, _, _], [_, _, R]]);
  assertEqual(projectLeft(model), [[_, _, _], [_, _, _], [R, _, _]]);
  assertEqual(projectRight(model), [[_, _, _], [_, _, _], [_, _, R]]);
});

test('방향 확인: 앞-오른쪽 구석(x=2, z=2)의 블록 하나', () => {
  const model = parseModel(['. . .', '. . .', '. . G']);
  assertEqual(projectTop(model), [[_, _, _], [_, _, _], [_, _, G]]);
  assertEqual(projectFront(model)[2], [_, _, G]);
  assertEqual(projectBack(model)[2], [G, _, _]);
  assertEqual(projectLeft(model)[2], [_, _, G]);
  assertEqual(projectRight(model)[2], [G, _, _]);
});

test('전/후: 가까운 블록이 먼 블록을 가린다', () => {
  // x=1 열: 뒤(z=0)에 RR, 앞(z=2)에 B
  const model = parseModel(['. RR .', '. . .', '. B .']);
  assertEqual(projectFront(model), [[_, _, _], [_, R, _], [_, B, _]]);
  assertEqual(projectBack(model), [[_, _, _], [_, R, _], [_, R, _]]);
});

test('좌/우: 가까운 블록이 먼 블록을 가린다', () => {
  // z=1 행: 왼쪽(x=0)에 Y, 오른쪽(x=2)에 PP
  const model = parseModel(['. . .', 'Y . PP', '. . .']);
  assertEqual(projectLeft(model), [[_, _, _], [_, P, _], [_, Y, _]]);
  assertEqual(projectRight(model), [[_, _, _], [_, P, _], [_, P, _]]);
});

test('상: 각 칸의 맨 위 블록 색이 보인다', () => {
  const model = parseModel(['RB G .', '. OYP .', 'B . R']);
  assertEqual(projectTop(model), [[B, G, _], [_, P, _], [B, _, R]]);
});

test('가로와 높이가 다른 격자도 처리한다', () => {
  const model = parseModel(['RGB .', '. Y'], 4);
  assertEqual(projectFront(model), [[_, _], [B, _], [G, _], [R, Y]]);
  assertEqual(projectRight(model), [[_, _], [_, B], [_, G], [Y, R]]);
});

// --- 판정 ---
const cube = (center) => parseModel([
  'RRR RRR RRR',
  `RRR ${center}R RRR`,
  'RRR RRR RRR',
]);

test('정답 모형은 정답으로 판정된다', () => {
  const answer = parseModel(['GG . .', 'G R .', 'B R Y']);
  const result = judge(answer, puzzleFromModel('t', answer));
  assert(result.correct && result.countsMatch);
  assert(Object.values(result.views).every(Boolean));
});

test('평면도와 블록 수가 같으면 원본과 달라도 정답이다', () => {
  // 3×3×3 정육면체 가운데 기둥의 아래 두 칸은 어느 방향에서도 보이지 않는다.
  const puzzle = puzzleFromModel('t', cube('BG'));
  const other = cube('GB');
  assert(JSON.stringify(other) !== JSON.stringify(puzzle.answer));
  assert(judge(other, puzzle).correct);
});

test('평면도가 같아도 블록 수가 다르면 오답이다', () => {
  const puzzle = puzzleFromModel('t', cube('BG'));
  const result = judge(cube('BB'), puzzle);
  assert(Object.values(result.views).every(Boolean), '평면도는 모두 일치해야 함');
  assert(!result.countsMatch && !result.correct);
});

test('평면도가 다르면 어느 평면도가 틀렸는지 알려준다', () => {
  const puzzle = puzzleFromModel('t', parseModel(['R .', '. .']));
  const result = judge(parseModel(['. R', '. .']), puzzle);
  assert(!result.correct && result.countsMatch);
  assertEqual(result.views, { top: false, front: false, back: false, left: true, right: true });
});

test('점수: 제출 ±1, 불가능 ±2', () => {
  const solvable = PUZZLES.find((puzzle) => puzzle.solvable);
  const impossible = PUZZLES.find((puzzle) => !puzzle.solvable);
  assertEqual(scoreSubmit(solvable.answer, solvable).delta, 1);
  assertEqual(scoreSubmit(createModel(solvable.size), solvable).delta, -1);
  assertEqual(scoreImpossible(impossible).delta, 2);
  assertEqual(scoreImpossible(solvable).delta, -2);
});

// --- 샘플 문제 ---
test('가능한 샘플 문제는 모두 정답 모형이 판정을 통과한다', () => {
  for (const puzzle of PUZZLES.filter((p) => p.solvable)) {
    assert(judge(puzzle.answer, puzzle).correct, `${puzzle.id}의 정답 모형이 통과하지 못함`);
  }
});

test('전수 탐색: 3×3 샘플 문제의 가능/불가능 표시가 실제와 같다', () => {
  for (const puzzle of PUZZLES.filter((p) => p.size === 3)) {
    assertEqual([puzzle.id, hasSolution(puzzle)], [puzzle.id, puzzle.solvable]);
  }
});

test('샘플 문제에 가능한 문제와 불가능한 문제가 모두 있다', () => {
  assert(PUZZLES.some((p) => p.solvable) && PUZZLES.some((p) => !p.solvable));
  assert(PUZZLES.filter((p) => !p.solvable).every((p) => p.reason && p.answer === null));
});

// --- 문제 생성기 ---
test('난수 생성기는 seed가 같으면 같은 수열을 낸다', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()], seqC = [c(), c(), c()];
  assertEqual(seqA, seqB);
  assert(JSON.stringify(seqA) !== JSON.stringify(seqC));
  assert(seqA.every((v) => v >= 0 && v < 1));
});

test('seed 코드는 왕복 변환되고 잘못된 코드는 거부된다', () => {
  for (const seed of [0, 1, 2847193, 0xffffffff]) assertEqual(decodeSeed(encodeSeed(seed)), seed);
  assertEqual(decodeSeed('zzzzzzzzz'), null);
  assertEqual(decodeSeed('abc-'), null);
  assertEqual(decodeSeed(''), null);
});

test('같은 난이도와 seed면 같은 문제, seed가 다르면 다른 문제', () => {
  const a = generatePuzzle('normal', 7), b = generatePuzzle('normal', 7), c = generatePuzzle('normal', 8);
  assertEqual(a.views, b.views);
  assertEqual(a.counts, b.counts);
  assert(JSON.stringify(a.views) !== JSON.stringify(c.views));
  assertEqual(a.id, 'normal-7');
});

test('생성된 문제는 모든 난이도에서 조건을 만족하고 정답이 판정을 통과한다', () => {
  for (const [difficulty, options] of Object.entries(DIFFICULTIES)) {
    for (let seed = 1; seed <= 150; seed++) {
      const puzzle = generatePuzzle(difficulty, seed);
      const where = `${difficulty} seed ${seed}`;
      assert(puzzle.solvable && puzzle.answer, where);
      assertEqual([puzzle.size, puzzle.height], [options.size, options.height]);
      const blocks = puzzle.counts.reduce((sum, count) => sum + count, 0);
      assert(blocks >= options.minBlocks && blocks <= options.maxBlocks, `${where}: 블록 ${blocks}개`);
      assertEqual(puzzle.counts.filter((count) => count > 0).length, options.colors);
      assert(puzzle.answer.columns.every((column) => column.length <= options.height), where);
      assert(puzzle.answer.columns.some((column) => column.length >= 2), `${where}: 한 층짜리`);
      assert(judge(puzzle.answer, puzzle).correct, where);
    }
  }
});

test('알 수 없는 난이도는 오류', () => {
  let threw = false;
  try { generatePuzzle('impossible', 1); } catch { threw = true; }
  assert(threw);
});

// --- 결과 출력 ---
const failed = results.filter((result) => !result.ok);
const summary = `${results.length - failed.length}개 통과, ${failed.length}개 실패`;

if (typeof document !== 'undefined') {
  document.getElementById('summary').textContent = summary;
  document.getElementById('summary').className = failed.length ? 'fail' : 'pass';
  document.getElementById('results').innerHTML = results
    .map((r) => `<li class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` — ${r.message}`}</li>`)
    .join('');
} else {
  const log = typeof console !== 'undefined' ? console.log : print; // jsc 모듈 모드에는 console이 없다
  for (const r of results) log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.message}`}`);
  log(`\n${summary}`);
}
