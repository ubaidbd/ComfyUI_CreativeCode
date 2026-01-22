/*
  TITLE          : MECHANICAL FLOWER BLOOM
  -------------------------------------------------------------------------
  ALGORITHM      : Radial Symmetry Modulation
  IMPLEMENTATION : Sinusoidal petal-extension & geometry rotation
  -------------------------------------------------------------------------
*/

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(0, 30);
  translate(width / 2, height / 2);
  let t = frameCount * 0.05;
  for (let i = 0; i < 8; i++) {
    push();
    rotate(TWO_PI / 8 * i);
    let x = map(sin(t), -1, 1, 50, 150);
    stroke(255);
    line(0, 0, x, sin(t + i) * 50);
    ellipse(x, sin(t + i) * 50, 10, 10);
    pop();
  }
}
