/*
  TITLE          : RETROWAVE NEON GRID
  -------------------------------------------------------------------------
  ALGORITHM      : Perspective-Correct Vector Grid projection
  IMPLEMENTATION : Ray-plane intersection & Spectral dispersion
  -------------------------------------------------------------------------
*/

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.345, 67.891))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime * 0.4;

    // 1. Sky Gradient & Background
    vec3 skyTop = vec3(0.05, 0.0, 0.1);
    vec3 skyBot = vec3(0.2, 0.0, 0.25);
    vec3 col = mix(skyBot, skyTop, uv.y);

    // 2. Segmented Vector Sun
    vec2 sunPos = vec2(0.0, 0.1);
    float dSun = length(p - sunPos);
    if (dSun < 0.3) {
        float sunVal = smoothstep(0.3, 0.29, dSun);
        // Stripes (Segmented effect)
        float stripes = step(0.1, fract((p.y - sunPos.y) * 15.0 - t * 0.5));
        float fade = mix(1.0, 0.0, (p.y - sunPos.y + 0.1) * 3.0);
        col = mix(col, vec3(1.0, 0.4, 0.1), sunVal * max(stripes, fade));
    }

    // 3. Perspective Grid Logic
    if (p.y < sunPos.y - 0.05) {
        float depth = 0.5 / (abs(p.y - (sunPos.y - 0.05)) + 0.01);
        vec2 gridUV = vec2(p.x * depth, depth + t * 2.0);
        
        // Grid lines with smoothing
        float gx = abs(fract(gridUV.x) - 0.5);
        float gy = abs(fract(gridUV.y) - 0.5);
        float grid = smoothstep(0.05, 0.0, min(gx, gy));
        
        // Chromatic Aberration on grid
        float r = smoothstep(0.06, 0.0, min(abs(fract(gridUV.x + 0.01) - 0.5), gy));
        float b = smoothstep(0.06, 0.0, min(abs(fract(gridUV.x - 0.01) - 0.5), gy));
        
        vec3 gCol = vec3(r * 0.8, grid, b * 0.9) * vec3(0.0, 1.0, 1.0);
        gCol += vec3(1.0, 0.0, 0.5) * grid * 0.5; // Pink glow
        
        col = mix(col, gCol, grid * smoothstep(-0.1, 0.5, p.y + 0.1));
    }

    // 4. Atmosphere & Scanlines
    col += vec3(0.1, 0.0, 0.2) * pow(1.0 - uv.y, 2.0); // Fog
    col *= 0.9 + 0.1 * sin(uv.y * 800.0 + t * 20.0); // High-res scanline
    
    // Vignette
    col *= 1.2 - length(p);

    fragColor = vec4(col, 1.0);
}
