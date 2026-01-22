/*
  TITLE          : HALFTONE POSTER
  -------------------------------------------------------------------------
  ALGORITHM      : High-Performance Halftone Screen (Digital Offset)
  IMPLEMENTATION : Rotated grid sampling with pixel-brightness mapping
  -------------------------------------------------------------------------
*/

// @uniform dot_spacing = 12.0
// @uniform dot_scale = 1.1

function setup() {
    createCanvas(640, 360);
    noStroke();
    // Use low frame rate for CPU heavy sketches
    frameRate(15);
}

function draw() {
    background(245, 240, 230); // Vintage Paper

    if (!this.iChannel0) return;

    // Cache image data
    iChannel0.loadPixels();
    if (iChannel0.pixels.length === 0) return;

    // PERFORMANCE OPTIMIZATION: Combine layers or skip empty dots
    // Higher spacing = much faster performance
    let spacing = max(dot_spacing, 8.0);

    drawHalftoneLayer([0, 255, 255, 140], 15, spacing); // Cyan
    drawHalftoneLayer([255, 0, 255, 140], 75, spacing); // Magenta
    drawHalftoneLayer([255, 255, 0, 140], 0, spacing);  // Yellow
    drawHalftoneLayer([0, 0, 0, 180], 45, spacing);     // Black
}

function drawHalftoneLayer(c, angle, spacing) {
    fill(c);
    let rad = radians(angle);
    let cosA = cos(-rad);
    let sinA = sin(-rad);

    push();
    translate(width / 2, height / 2);
    rotate(radians(angle));

    let range = max(width, height) * 1.3;
    let imgW = iChannel0.width;
    let imgH = iChannel0.height;

    for (let y = -range / 2; y < range / 2; y += spacing) {
        for (let x = -range / 2; x < range / 2; x += spacing) {

            // Sample coordinates
            let sX = x * cosA - y * sinA + width / 2;
            let sY = x * sinA + y * cosA + height / 2;

            if (sX >= 0 && sX < width && sY >= 0 && sY < height) {
                let u = floor(map(sX, 0, width, 0, imgW));
                let v = floor(map(sY, 0, height, 0, imgH));

                let idx = (v * imgW + u) * 4;
                let brightness = (iChannel0.pixels[idx] + iChannel0.pixels[idx + 1] + iChannel0.pixels[idx + 2]) / 3;

                // Only draw if it's dark enough to have a visible dot
                if (brightness < 240) {
                    let size = (1 - brightness / 255) * spacing * dot_scale;
                    if (size > 1.5) {
                        // Drawing circles is expensive in 2D; skip very small ones
                        ellipse(x, y, size, size);
                    }
                }
            }
        }
    }
    pop();
}
