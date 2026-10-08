// 평면도(투영) 계산.
// 각 평면도는 2차원 배열 view[row][col]이며 row는 위→아래, col은 "그 방향에서 바라본" 왼쪽→오른쪽.
// 각 칸의 값은 시선이 처음 만나는 블록의 색(없으면 EMPTY).

import { EMPTY, cellAt, getColumn } from './model.js';

export const VIEW_NAMES = ['top', 'front', 'back', 'left', 'right'];

function grid(rows, cols, cell) {
  return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => cell(row, col)));
}

/** 상: 위에서 내려다봄. 위쪽 행이 뒤(z=0), 아래쪽 행이 앞. */
export function projectTop(model) {
  const n = model.size;
  return grid(n, n, (row, col) => {
    const column = getColumn(model, col, row);
    return column.length ? column[column.length - 1] : EMPTY;
  });
}

// 옆면 4방향 공통: (row, col)마다 시선 위의 칸들을 가까운 순서로 훑는다.
function projectSide(model, cellOnRay) {
  const { size: n, height: h } = model;
  return grid(h, n, (row, col) => {
    const y = h - 1 - row;
    for (let depth = 0; depth < n; depth++) {
      const color = cellOnRay(col, y, depth);
      if (color !== EMPTY) return color;
    }
    return EMPTY;
  });
}

/** 전: 앞(+z)에서 봄. 왼쪽 열이 x=0. */
export function projectFront(model) {
  const n = model.size;
  return projectSide(model, (col, y, depth) => cellAt(model, col, y, n - 1 - depth));
}

/** 후: 뒤(-z)에서 봄. 전과 좌우가 반대라 왼쪽 열이 x=n-1. */
export function projectBack(model) {
  const n = model.size;
  return projectSide(model, (col, y, depth) => cellAt(model, n - 1 - col, y, depth));
}

/** 좌: 왼쪽(-x)에서 봄. 왼쪽 열이 뒤(z=0), 오른쪽 열이 앞. */
export function projectLeft(model) {
  return projectSide(model, (col, y, depth) => cellAt(model, depth, y, col));
}

/** 우: 오른쪽(+x)에서 봄. 왼쪽 열이 앞(z=n-1), 오른쪽 열이 뒤. */
export function projectRight(model) {
  const n = model.size;
  return projectSide(model, (col, y, depth) => cellAt(model, n - 1 - depth, y, n - 1 - col));
}

export function projectAll(model) {
  return {
    top: projectTop(model),
    front: projectFront(model),
    back: projectBack(model),
    left: projectLeft(model),
    right: projectRight(model),
  };
}

export function viewsEqual(a, b) {
  return (
    a.length === b.length &&
    a.every((row, r) => row.length === b[r].length && row.every((cell, c) => cell === b[r][c]))
  );
}
