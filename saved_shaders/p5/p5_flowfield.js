/*
  TITLE          : PERLIN FLOW FIELD
  -------------------------------------------------------------------------
  ALGORITHM      : Perlin Noise Vector Field Integration
  IMPLEMENTATION : Euler integration with magnitude-limited velocity
  -------------------------------------------------------------------------
*/

// @uniform float speed = 1.0
// @uniform float noise_scale = 0.005
// @uniform float particle_count = 800

let particles = [];
let palette = [
    [255, 100, 100], // Coral
    [100, 255, 200], // Mint
    [100, 200, 255], // Sky
    [255, 255, 255]  // White
];

function setup() {
    createCanvas(640, 360);
    background(10);
    for (let i = 0; i < particle_count; i++) {
        particles.push(new Particle());
    }
}

function draw() {
    // Semi-transparent background for trails
    background(10, 15);

    for (let p of particles) {
        p.update();
        p.display();
    }
}

class Particle {
    constructor() {
        this.init();
    }

    init() {
        this.pos = createVector(random(width), random(height));
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        this.maxSpeed = random(1, 3);
        this.prevPos = this.pos.copy();

        let c = random(palette);
        this.color = color(c[0], c[1], c[2], 150);
    }

    update() {
        this.prevPos = this.pos.copy();

        // Flow field logic
        let angle = noise(this.pos.x * noise_scale, this.pos.y * noise_scale, frameCount * 0.005) * TWO_PI * 4;
        let force = p5.Vector.fromAngle(angle).setMag(0.1);

        this.acc.add(force);
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed * speed);
        this.pos.add(this.vel);
        this.acc.mult(0);

        // Bound check
        if (this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height) {
            this.init();
            this.prevPos = this.pos.copy();
        }
    }

    display() {
        stroke(this.color);
        strokeWeight(1.5);
        line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
    }
}
