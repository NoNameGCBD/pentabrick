// 격자 모델.
// 좌표계: x = 왼쪽→오른쪽, y = 아래→위, z = 뒤→앞 (앞에서 바라보는 기준).
// 모형은 칸(x, z)마다 "아래→위 색 스택"으로 저장한다.
// 스택 구조이므로 공중에 뜬 블록은 표현 자체가 불가능하다(규칙: 뜬 블록 금지).

export const EMPTY = 0;
export const COLOR_COUNT = 6; // 색 번호 1~6

const COLOR_LETTERS = { R: 1, O: 2, Y: 3, G: 4, B: 5, P: 6 };

export function isColor(value) {
  return Number.isInteger(value) && value >= 1 && value <= COLOR_COUNT;
}

export function createModel(size, height = size) {
  return { size, height, columns: Array.from({ length: size * size }, () => []) };
}

export function inBounds(model, x, z) {
  return x >= 0 && x < model.size && z >= 0 && z < model.size;
}

function columnIndex(model, x, z) {
  return z * model.size + x;
}

export function getColumn(model, x, z) {
  return model.columns[columnIndex(model, x, z)];
}

export function cellAt(model, x, y, z) {
  return getColumn(model, x, z)[y] ?? EMPTY;
}

function withColumn(model, x, z, column) {
  const columns = model.columns.slice();
  columns[columnIndex(model, x, z)] = column;
  return { ...model, columns };
}

// 아래 편집 함수들은 원본을 바꾸지 않고 새 모형을 돌려준다. 불가능한 편집이면 null.

/** 칸(x, z)의 맨 위에 블록을 쌓는다. */
export function placeBlock(model, x, z, color) {
  if (!inBounds(model, x, z) || !isColor(color)) return null;
  const column = getColumn(model, x, z);
  if (column.length >= model.height) return null;
  return withColumn(model, x, z, [...column, color]);
}

/** 블록을 제거한다. 위에 있던 블록은 한 칸씩 내려온다. */
export function removeBlock(model, x, y, z) {
  if (!inBounds(model, x, z)) return null;
  const column = getColumn(model, x, z);
  if (y < 0 || y >= column.length) return null;
  return withColumn(model, x, z, column.filter((_, i) => i !== y));
}

/** 블록의 색을 바꾼다. */
export function paintBlock(model, x, y, z, color) {
  if (!inBounds(model, x, z) || !isColor(color)) return null;
  const column = getColumn(model, x, z);
  if (y < 0 || y >= column.length || column[y] === color) return null;
  return withColumn(model, x, z, column.map((c, i) => (i === y ? color : c)));
}

/** 색별 사용 개수. 반환 배열의 인덱스가 색 번호(0번은 항상 0). */
export function countColors(model) {
  const counts = new Array(COLOR_COUNT + 1).fill(0);
  for (const column of model.columns) {
    for (const color of column) counts[color]++;
  }
  return counts;
}

export function totalBlocks(model) {
  return model.columns.reduce((sum, column) => sum + column.length, 0);
}

/**
 * 문자열로 모형을 만든다. rows는 뒤(z=0)→앞 순서, 각 행은 공백으로 구분한 칸들.
 * 칸은 아래→위 색 글자(R O Y G B P), 빈 칸은 '.'
 * 예: parseModel(['BB G .', 'B . Y', 'BR Y .'])
 */
export function parseModel(rows, height = rows.length) {
  const size = rows.length;
  const model = createModel(size, height);
  rows.forEach((row, z) => {
    const cells = row.trim().split(/\s+/);
    if (cells.length !== size) throw new Error(`행 ${z}의 칸 수가 ${size}개가 아님: "${row}"`);
    cells.forEach((cell, x) => {
      if (cell === '.') return;
      const column = [...cell].map((letter) => {
        const color = COLOR_LETTERS[letter];
        if (!color) throw new Error(`알 수 없는 색 글자: "${letter}"`);
        return color;
      });
      if (column.length > height) throw new Error(`칸 (${x}, ${z})이 최대 높이 ${height}를 넘음`);
      model.columns[columnIndex(model, x, z)] = column;
    });
  });
  return model;
}
