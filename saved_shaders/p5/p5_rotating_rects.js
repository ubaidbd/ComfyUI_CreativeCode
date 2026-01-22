/*
  TITLE          : MINIMALIST ROTATING PRISMS
  -------------------------------------------------------------------------
  ALGORITHM      : Nested Geometric Transformation
  IMPLEMENTATION : Concentric rectangle rotation & color-stepped wireframes
  -------------------------------------------------------------------------
*/

let angle = 0;

function setup() {
    createCanvas(400, 400);
}

function draw() {
    background(0);
    translate(width / 2, height / 2);

    rotate(angle);
    rectMode(CENTER);

    noFill();
    stroke(255);
    strokeWeight(2);

    // Scale based on smaller dimension
    let s = min(width, height) / 2;

    rect(0, 0, s, s);

    stroke(255, 0, 0);
    rect(0, 0, s * 0.75, s * 0.75);

    stroke(0, 255, 0);
    rect(0, 0, s * 0.5, s * 0.5);

    angle += 0.02;
}
