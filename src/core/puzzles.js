// 프로토타입용 샘플 문제.
// 문제 생성기와 솔버(3~4단계)가 생기기 전까지 손으로 만든 문제를 쓴다.
// 불가능 문제는 해가 없음을 tests/core.test.js의 전수 탐색으로 확인한다.

import { countColors, parseModel } from './model.js';
import { projectAll } from './projection.js';

const G = 4, B = 5, P = 6;

/** 정답 모형에서 문제를 만든다(해가 반드시 존재). */
export function puzzleFromModel(id, answer) {
  return {
    id,
    size: answer.size,
    height: answer.height,
    views: projectAll(answer),
    counts: countColors(answer),
    solvable: true,
    answer,
  };
}

function impossiblePuzzle(id, base, reason, tamper) {
  const puzzle = { ...puzzleFromModel(id, base), solvable: false, answer: null, reason };
  tamper(puzzle);
  return puzzle;
}

export const PUZZLES = [
  puzzleFromModel('p1', parseModel([
    'GG .  .',
    'G  R  .',
    'B  R  Y',
  ])),

  puzzleFromModel('p2', parseModel([
    'RBR BB .',
    'YY  G  B',
    'Y   .  GP',
  ])),

  // 색 가림 모순: 전(앞) 평면도 왼쪽 열의 빨강을 파랑으로 바꿨다.
  impossiblePuzzle(
    'p3',
    parseModel([
      'BB G .',
      'B  . Y',
      'BR Y .',
    ]),
    '상(위) 평면도에서 맨 앞줄 왼쪽 칸의 꼭대기는 빨강입니다. 맨 앞줄은 앞에서 볼 때 가려질 수 없으므로 전(앞) 평면도의 왼쪽 열에도 빨강이 보여야 하는데, 보이지 않습니다.',
    (puzzle) => {
      puzzle.views.front[1][0] = B;
    },
  ),

  puzzleFromModel('p4', parseModel([
    'PP P   .  G',
    'B  BRB O  G',
    '.  Y   OO .',
    'R  Y   .  GGG',
  ])),

  // 블록 수 모순: 초록 하나를 숨길 곳 없는 보라로 바꿨다.
  impossiblePuzzle(
    'p5',
    parseModel([
      'R .  B',
      '. GG .',
      'Y .  O',
    ]),
    '평면도대로라면 가운데 기둥은 초록 2개여야 하는데 초록 블록은 1개뿐입니다. 남는 보라 블록은 어느 평면도에도 보이지 않아야 하지만 숨길 자리가 없습니다.',
    (puzzle) => {
      puzzle.counts[G] -= 1;
      puzzle.counts[P] += 1;
    },
  ),

  puzzleFromModel('p6', parseModel([
    'OO O   O  .',
    'B  BPB BB Y',
    'B  GRG GG Y',
    '.  G   G  YR',
  ])),
];
