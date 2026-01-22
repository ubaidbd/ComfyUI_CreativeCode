/*
  TITLE          : 3D KINETIC STARFIELD
  -------------------------------------------------------------------------
  ALGORITHM      : Perspective Z-Projection Starfield
  IMPLEMENTATION : Distance-mapped radius & historical-position trails
  -------------------------------------------------------------------------
*/

// @uniform float speed = 5.0 (min: 1.0, max: 20.0)

let stars = [];

function setup() {
    createCanvas(width, height);
    for (let i = 0; i < 400; i++) {
        stars.push({
            x: random(-width, width),
            y: random(-height, height),
            z: random(width),
            pz: 0
        });
        stars[i].pz = stars[i].z;
    }
}

function draw() {
    background(0);
    translate(width / 2, height / 2);

    for (let s of stars) {
        s.z -= speed;
        if (s.z < 1) {
            s.x = random(-width, width);
            s.y = random(-height, height);
            s.z = width;
            s.pz = s.z;
        }

        let sx = map(s.x / s.z, 0, 1, 0, width);
        let sy = map(s.y / s.z, 0, 1, 0, height);
        let r = map(s.z, 0, width, 8, 0);

        fill(255);
        noStroke();
        ellipse(sx, sy, r, r);

        let px = map(s.x / s.pz, 0, 1, 0, width);
        let py = map(s.y / s.pz, 0, 1, 0, height);
        s.pz = s.z;

        stroke(255, 100);
        line(px, py, sx, sy);
    }
}
