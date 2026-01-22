/*
  TITLE          : INTERACTIVE SCALE GRID
  -------------------------------------------------------------------------
  ALGORITHM      : Sine-Phase Grid Animation
  IMPLEMENTATION : Time-based cell scale modulation
  -------------------------------------------------------------------------
*/

function setup() {
    createCanvas(400, 400);
}

function draw() {
    background(0);

    let t = millis() / 1000.0;
    let cols = 20;
    let rows = 20;
    let cellW = width / cols;
    let cellH = height / rows;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let x = i * cellW;
            let y = j * cellH;

            let d = sin(t + i * 0.3) * cos(t + j * 0.3) * min(cellW, cellH);

            fill(255);
            rectMode(CENTER);
            rect(x + cellW / 2, y + cellH / 2, abs(d), abs(d));
        }
    }
}
