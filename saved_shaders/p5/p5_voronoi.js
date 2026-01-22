/*
  TITLE          : VORONOI CELLULAR TILING
  -------------------------------------------------------------------------
  ALGORITHM      : Discrete Voronoi Diagram (Nearest-Neighbor)
  IMPLEMENTATION : Pixel-step iterative distance calculation & border detection
  -------------------------------------------------------------------------
*/

let nodes = [];
const numNodes = 15;

function setup() {
    createCanvas(640, 360);
    for (let i = 0; i < numNodes; i++) {
        nodes.push({
            pos: createVector(random(width), random(height)),
            vel: p5.Vector.random2D().mult(random(0.5, 1.5)),
            color: color(random(50, 100), random(150, 255), random(200, 255), 180)
        });
    }
}

function draw() {
    background(10, 20, 30);

    // Low-res double loop for performance but with artistic blur
    let step = 8;
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            let minDist = 1000;
            let secondMinDist = 1000;
            let closestNode = null;

            for (let n of nodes) {
                let d = dist(x, y, n.pos.x, n.pos.y);
                if (d < minDist) {
                    secondMinDist = minDist;
                    minDist = d;
                    closestNode = n;
                } else if (d < secondMinDist) {
                    secondMinDist = d;
                }
            }

            // Cell border effect (distance between closest and second closest)
            let border = secondMinDist - minDist;
            let c = closestNode.color;

            // Soft cell interior
            fill(red(c), green(c), blue(c), map(minDist, 0, 200, 200, 20));
            noStroke();
            rect(x, y, step, step);

            // Highlight borders
            if (border < 10) {
                fill(255, 50);
                rect(x, y, step, step);
            }
        }
    }

    // Update nodes
    for (let n of nodes) {
        n.pos.add(n.vel);
        if (n.pos.x < 0 || n.pos.x > width) n.vel.x *= -1;
        if (n.pos.y < 0 || n.pos.y > height) n.vel.y *= -1;

        // Slight organic oscillation
        n.vel.rotate(sin(frameCount * 0.02) * 0.05);
    }
}
