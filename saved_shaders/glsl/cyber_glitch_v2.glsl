/*
  TITLE          : CYBER GLITCH V2
  -------------------------------------------------------------------------
  ALGORITHM      : Multi-stage Digital Bitstream Corruption
  IMPLEMENTATION : Hash-seeded spatial quantization & Chromatic drift
  -------------------------------------------------------------------------
*/

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.345, 67.891))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime;
    
    // 1. Global Intensity Modulation (Dynamic random trigger)
    float intensity = step(0.85, hash(vec2(floor(t * 12.0), 7.0)));
    float seed = hash(vec2(floor(t * 15.0)));
    
    // 2. Spatial Block Quantization (Pixelation Glitch)
    vec2 blockUV = uv;
    if (hash(vec2(floor(uv.y * 10.0), floor(t * 8.0))) > 0.8 * (1.0 - intensity)) {
        float blockSize = 10.0 + seed * 50.0;
        blockUV = floor(uv * blockSize) / blockSize;
    }
    
    // 3. Horizontal Scan-line Displacement
    float lineNoise = hash(vec2(floor(uv.y * 100.0), t));
    float xOff = (lineNoise - 0.5) * 0.1 * intensity * step(0.9, hash(vec2(t, 2.0)));
    
    // 4. Multi-channel Chromatic Drift
    float caBase = 0.05 * intensity;
    vec2 uvR = blockUV + vec2(xOff + caBase * seed, 0.0);
    vec2 uvG = blockUV + vec2(xOff, 0.0);
    vec2 uvB = blockUV + vec2(xOff - caBase * (1.0-seed), 0.01 * intensity);
    
    vec3 col;
    col.r = texture(iChannel0, uvR).r;
    col.g = texture(iChannel0, uvG).g;
    col.b = texture(iChannel0, uvB).b;
    
    // 5. Signal Inversion & Bit-stretching
    if (intensity > 0.5 && hash(vec2(floor(uv.y * 3.0), t)) > 0.7) {
        col = 1.0 - col; // Logic inversion
        col *= vec3(0.0, 1.0, 1.0); // Cyan tint on inverted blocks
    }
    
    // 6. Volumetric Digital Noise (Static)
    float n = hash(uv * 10.0 + t) * 0.15 * intensity;
    col += n;
    
    // 7. Post-processing: Matrix saturation boost
    col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), -0.5 * intensity);
    
    fragColor = vec4(col, 1.0);
}
