/*
  TITLE          : NEON SPIRAL RADIANCE
  -------------------------------------------------------------------------
  ALGORITHM      : Angular Coordinate Rotation
  IMPLEMENTATION : Phase-shifted line-segment mapping with HSB-like colors
  -------------------------------------------------------------------------
*/

let angle = 0;

function setup() {
    createCanvas(400, 400);
}

function draw() {
    background(0);
    translate(width / 2, height / 2);

    let maxDist = min(width, height) / 2;

    for (let i = 0; i < 100; i++) {
        push();
        rotate(i * 0.1 + angle);
        let dst = map(i, 0, 100, 0, maxDist);
        stroke(i * 2.5, 255 - i * 2, 100);
        strokeWeight(2);
        line(dst, 0, dst + 10, 0);
        pop();
    }

    angle += 0.02;
}
