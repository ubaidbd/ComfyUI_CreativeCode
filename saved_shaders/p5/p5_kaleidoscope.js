/*
  TITLE          : KALEIDOSCOPIC RADIUS SHIFT
  -------------------------------------------------------------------------
  ALGORITHM      : Iterative Angular Offsetting
  IMPLEMENTATION : Elliptic radius modulation & spectral color cycling
  -------------------------------------------------------------------------
*/

function setup() {
  createCanvas(400, 400);
  noFill();
}

function draw() {
  background(10, 20);
  translate(width / 2, height / 2);
  let t = frameCount * 0.02;
  for (let i = 0; i < 50; i++) {
    let r = 50 + i * 4;
    let a = t + i * 0.1;
    let x = sin(a) * r;
    let y = cos(a * 0.5) * r;
    stroke(127 + 127 * sin(a), 255, 255 - i * 4);
    ellipse(0, 0, x, y);
    rotate(0.1);
  }
}
