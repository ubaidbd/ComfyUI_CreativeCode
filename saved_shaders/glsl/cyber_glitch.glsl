/*
  TITLE          : CYBER GLITCH
  -------------------------------------------------------------------------
  ALGORITHM      : Block-based Pseudo-Random UV Distortion
  IMPLEMENTATION : Time-sliced hash functions for discrete x-axis displacement
  -------------------------------------------------------------------------
*/

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.345, 67.891))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime;

    // 1. Blocky Glitch Logic
    vec2 blockUV = floor(uv * vec2(10.0, 30.0));
    float blockNoise = hash(blockUV + floor(t * 10.0));
    
    float glitchTrigger = step(0.9, hash(vec2(floor(t * 8.0))));
    float xOffset = (blockNoise - 0.5) * 0.1 * glitchTrigger * step(0.8, hash(vec2(blockUV.y, floor(t * 15.0))));

    // 2. Chromatic Aberration
    float caAmount = 0.02 * glitchTrigger;
    vec2 uvR = uv + vec2(xOffset + caAmount, 0.0);
    vec2 uvG = uv + vec2(xOffset, 0.0);
    vec2 uvB = uv + vec2(xOffset - caAmount, 0.0);

    vec4 colR = texture(iChannel0, uvR);
    vec4 colG = texture(iChannel0, uvG);
    vec4 colB = texture(iChannel0, uvB);

    vec3 finalCol = vec3(colR.r, colG.g, colB.b);

    // 3. Overlay FX (Grid & Scanlines)
    float scanline = sin(uv.y * 800.0) * 0.03;
    finalCol -= scanline;
    
    float grid = step(0.995, fract(uv.x * 20.0)) + step(0.995, fract(uv.y * 20.0));
    finalCol += grid * 0.1 * vec3(0.0, 1.0, 1.0) * glitchTrigger;

    // 4. Color Grading
    finalCol = mix(finalCol, vec3(dot(finalCol, vec3(0.299, 0.587, 0.114))), -0.2); // Boost saturation
    finalCol.g *= 1.05; // Cyberpunk tint
    
    // Vignette
    finalCol *= 1.1 - length(uv - 0.5) * 0.5;

    fragColor = vec4(finalCol, 1.0);
}
