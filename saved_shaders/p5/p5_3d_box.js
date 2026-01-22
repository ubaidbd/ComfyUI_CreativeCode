/*
  TITLE          : 3D KINETIC PRISM
  -------------------------------------------------------------------------
  ALGORITHM      : Recursive Euler Rotation
  IMPLEMENTATION : WEBGL-based coordinate transformation & center glow
  -------------------------------------------------------------------------
*/

function setup() {
    createCanvas(640, 360, WEBGL);
    smooth();
}

function draw() {
    background(10, 15, 25);

    // Global coordinate system modulation
    let t = frameCount * 0.01;
    rotateX(t * 0.5);
    rotateY(t * 0.3);
    rotateZ(t * 0.2);

    // Render configuration: Normal-vector based color mapping
    normalMaterial();
    stroke(255, 40); // Subtle wireframe overlay
    strokeWeight(0.5);

    // 1. Core Kinetic Shell
    push();
    rotateY(sin(t) * PI);
    box(100);
    pop();

    // 2. Secondary Gimbal Shell
    push();
    rotateX(cos(t * 0.8) * PI * 0.5);
    noFill();
    stroke(0, 255, 200, 150);
    strokeWeight(1.5);
    box(150);
    pop();

    // 3. Outer Frame (Point Clouds / Vertices)
    push();
    rotateZ(t * 1.5);
    stroke(255, 0, 150, 100);
    for (let i = 0; i < 8; i++) {
        let x = (i % 2 == 0 ? 1 : -1) * 120;
        let y = ((i >> 1) % 2 == 0 ? 1 : -1) * 120;
        let z = ((i >> 2) % 2 == 0 ? 1 : -1) * 120;
        push();
        translate(x, y, z);
        sphere(5);
        pop();
    }
    pop();

    // Volumetric center glow (simulated)
    push();
    noStroke();
    fill(255, 255, 255, 20);
    sphere(40 + sin(t * 5.0) * 10);
    pop();
}
