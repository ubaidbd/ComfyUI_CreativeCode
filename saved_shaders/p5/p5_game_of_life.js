/*
  TITLE          : DIGITAL GAME OF LIFE
  -------------------------------------------------------------------------
  ALGORITHM      : Cellular Automata (Conway)
  IMPLEMENTATION : Discrete grid state simulation & pixel rendering
  -------------------------------------------------------------------------
*/

let grid = [];
let cols, rows;
function setup() {
  createCanvas(400, 400);
  cols = floor(width / 10);
  rows = floor(height / 10);
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) grid[i][j] = random() > 0.8 ? 1 : 0;
  }
}

function draw() {
  background(0);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j] === 1) {
        fill(0, 255, 100);
        rect(i * 10, j * 10, 9, 9);
      }
    }
  }
  // Very basic simulation step
  if (frameCount % 10 === 0) {
    let next = [];
    for (let i = 0; i < cols; i++) {
      next[i] = [];
      for (let j = 0; j < rows; j++) {
        let neighbors = 0;
        for (let x = -1; x <= 1; x++) {
          for (let y = -1; y <= 1; y++) {
            if (x === 0 && y === 0) continue;
            neighbors += grid[(i + x + cols) % cols][(j + y + rows) % rows];
          }
        }
        if (grid[i][j] === 1 && (neighbors < 2 || neighbors > 3)) next[i][j] = 0;
        else if (grid[i][j] === 0 && neighbors === 3) next[i][j] = 1;
        else next[i][j] = grid[i][j];
      }
    }
    grid = next;
  }
}
