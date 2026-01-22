/*
  TITLE          : RECURSIVE FRACTAL TREE
  -------------------------------------------------------------------------
  ALGORITHM      : Bifurcating Recursive Branching
  IMPLEMENTATION : Matrix transform stack & sinusoidal angle oscillation
  -------------------------------------------------------------------------
*/

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(0);
  stroke(255, 150);
  translate(width / 2, height);
  let a = (mouseX / width) * PI || PI / 6;
  branch(100, sin(frameCount * 0.01) * 0.5);
}

function branch(len, angle) {
  line(0, 0, 0, -len);
  translate(0, -len);
  if (len > 4) {
    push(); rotate(0.4 + angle); branch(len * 0.67, angle); pop();
    push(); rotate(-0.4 + angle); branch(len * 0.67, angle); pop();
  }
}
