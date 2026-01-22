/*
  TITLE          : CHROMA SPIROGRAPH
  -------------------------------------------------------------------------
  ALGORITHM      : Harmonic Sine Oscillation Trails
  IMPLEMENTATION : HSB color-cycling & semi-transparent motion blur
  -------------------------------------------------------------------------
*/

function setup() {
  createCanvas(400, 400);
  colorMode(HSB, 255);
}

function draw() {
  background(0, 10);
  translate(width / 2, height / 2);
  let speed = frameCount * 0.05;
  for (let i = 0; i < 200; i += 2) {
    let r = i + sin(speed + i * 0.1) * 20;
    let a = i * 0.5 + speed;
    let x = cos(a) * r;
    let y = sin(a) * r;
    stroke(i % 255, 200, 255);
    line(0, 0, x, y);
    ellipse(x, y, 4, 4);
  }
}
