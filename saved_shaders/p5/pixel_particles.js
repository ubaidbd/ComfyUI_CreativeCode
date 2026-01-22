/*
  TITLE          : DYNAMIC BOKEH PARTICLES
  -------------------------------------------------------------------------
  ALGORITHM      : Luminance-Weighted Particle Drift
  IMPLEMENTATION : Noise-driven angular motion & bokeh-layer rendering
  -------------------------------------------------------------------------
*/

// @uniform float speed = 1.0
// @uniform float particle_size = 1.0
// @uniform float glow_intensity = 0.5

let particles = [];
const numParticles = 1200;

function setup() {
    createCanvas(640, 360);
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }
}

function draw() {
    background(0, 30); // Soft motion blur

    if (!this.iChannel0) {
        fill(255);
        textAlign(CENTER);
        text("Connect iChannel0 to see the Magic", width / 2, height / 2);
        return;
    }

    for (let p of particles) {
        p.update();
        p.display();
    }
}

class Particle {
    constructor() {
        this.pos = createVector(random(width), random(height));
        this.vel = createVector(random(-1, 1), random(-1, 1));
        this.baseSize = random(2, 8);
        this.noiseOffset = random(1000);
    }

    update() {
        // Organic drifting
        let n = noise(this.pos.x * 0.005, this.pos.y * 0.005, frameCount * 0.01 + this.noiseOffset);
        let angle = n * TWO_PI * 2;
        let drift = p5.Vector.fromAngle(angle).mult(0.2);

        this.vel.add(drift);
        this.vel.limit(2 * speed);
        this.pos.add(this.vel);

        // Screen wraps
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.y < 0) this.pos.y = height;
        if (this.pos.y > height) this.pos.y = 0;
    }

    display() {
        let u = floor(map(this.pos.x, 0, width, 0, iChannel0.width));
        let v = floor(map(this.pos.y, 0, height, 0, iChannel0.height));

        // Sampling color
        let col = iChannel0.get(constrain(u, 0, iChannel0.width - 1), constrain(v, 0, iChannel0.height - 1));
        let brightness = (col[0] + col[1] + col[2]) / 3;

        // Render glowing particle
        let s = this.baseSize * particle_size * (brightness / 255 + 0.5);

        // Glow effect (layers)
        noStroke();
        fill(col[0], col[1], col[2], 50 * glow_intensity);
        ellipse(this.pos.x, this.pos.y, s * 2, s * 2); // Outer glow
        fill(col[0], col[1], col[2], 200);
        ellipse(this.pos.x, this.pos.y, s, s); // Core
    }
}
