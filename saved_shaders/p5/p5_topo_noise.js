/*
  TITLE          : TOPOGRAPHIC NOISE FIELD
  -------------------------------------------------------------------------
  ALGORITHM      : 2D Perlin Noise Domain Warping
  IMPLEMENTATION : Segmented CurveVertex interpolation & radial displacement
  -------------------------------------------------------------------------
*/

let offset = 0;
function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(255);
  stroke(0);
  noFill();
  for (let x = 0; x < width; x += 20) {
    beginShape();
    for (let y = 0; y < height; y += 20) {
      let d = dist(x, y, width / 2, height / 2);
      let noiseVal = noise(x * 0.01, y * 0.01, frameCount * 0.02);
      let xOff = map(noiseVal, 0, 1, -20, 20);
      curveVertex(x + xOff, y);
    }
    endShape();
  }
}
