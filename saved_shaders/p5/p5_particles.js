/*
  TITLE          : ELASTIC PARTICLE SYSTEM
  -------------------------------------------------------------------------
  ALGORITHM      : Discrete Velocity Integration
  IMPLEMENTATION : Boundary-checking particle physics & trail-blur rendering
  -------------------------------------------------------------------------
*/

let particles = [];

function setup() {
    createCanvas(400, 400);
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: random(width),
            y: random(height),
            vx: random(-2, 2),
            vy: random(-2, 2),
            size: random(2, 5)
        });
    }
}

function draw() {
    background(0, 50);

    noStroke();
    fill(0, 255, 255);

    for (let p of particles) {
        ellipse(p.x, p.y, p.size);

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
    }
}
