/*
  TITLE          : 3D CUBE CLUSTER
  -------------------------------------------------------------------------
  ALGORITHM      : Harmonic Coordinate Modulation
  IMPLEMENTATION : 3D Distance-based scale animation (WEBGL)
  -------------------------------------------------------------------------
*/

function setup() {
  createCanvas(400, 400, WEBGL);
}

function draw() {
  background(20);
  rotateY(frameCount * 0.01);
  rotateX(frameCount * 0.01);
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      for (let k = -2; k <= 2; k++) {
        push();
        translate(i * 40, j * 40, k * 40);
        let d = dist(i, j, k, 0, 0, 0);
        let s = sin(frameCount * 0.1 + d) * 1.5;
        scale(s);
        normalMaterial();
        box(15);
        pop();
      }
    }
  }
}
