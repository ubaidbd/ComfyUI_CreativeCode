/*
  TITLE          : 3D WAVE SURFACE
  -------------------------------------------------------------------------
  ALGORITHM      : Multi-octave Perlin Noise Surface
  IMPLEMENTATION : TRIANGLE_STRIP geometry with Phong-style lighting
  -------------------------------------------------------------------------
*/

function setup() {
    createCanvas(640, 360, WEBGL);
    noStroke();
}

function draw() {
    background(2, 5, 12);

    // Technical Fix: Explicit Perspective
    // FOV, Aspect, Near, Far
    perspective(PI / 3.0, width / height, 0.1, 2000);

    // Cinematic Lighting Rig
    ambientLight(40, 60, 100);
    pointLight(0, 255, 255, 200, -400, 300); // Cyan
    pointLight(255, 0, 150, -200, 400, 300); // Magenta

    // Camera Position Logic
    let camX = cos(frameCount * 0.005) * 400;
    let camY = sin(frameCount * 0.005) * 400;
    camera(camX, camY, 300, 0, 0, 0, 0, 0, -1);

    let t = frameCount * 0.015;
    let spacing = 15; // Increased spacing for performance
    let range = 600;
    let noiseScale = 0.02;

    for (let y = -range / 2; y < range / 2 - spacing; y += spacing) {
        beginShape(TRIANGLE_STRIP);
        for (let x = -range / 2; x <= range / 2; x += spacing) {

            let z1 = noise(x * noiseScale, y * noiseScale, t) * 120;
            let z2 = noise(x * noiseScale, (y + spacing) * noiseScale, t) * 120;

            // Material response based on vertical displacement
            let h = map(z1, 0, 120, 0, 1);
            specularMaterial(h * 200 + 55);
            shininess(20);

            fill(20, 50, 150 + h * 100);
            vertex(x, y, z1);
            vertex(x, y + spacing, z2);
        }
        endShape();
    }
}
