/*
  TITLE          : VINTAGE CRT EFFECT
  -------------------------------------------------------------------------
  ALGORITHM      : Analog Screen Emulation
  IMPLEMENTATION : Barrel distortion, Scanlines & RGB shift
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Screen Curvature (Barrel Distortion)
    vec2 uvc = uv * 2.0 - 1.0;
    uvc *= 1.0 + pow(length(uvc) * 0.15, 2.0);
    uv = uvc * 0.5 + 0.5;
    
    // Black borders for curvature
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    // Chromatic Aberration / RGB Shift
    float shift = 0.003 * sin(iTime * 1.5);
    float r = texture(iChannel0, uv + vec2(shift, 0.0)).r;
    float g = texture(iChannel0, uv).g;
    float b = texture(iChannel0, uv - vec2(shift, 0.0)).b;
    
    vec3 col = vec3(r, g, b);
    
    // Scanlines
    float scanline = sin(fragCoord.y * 1.5 + iTime * 10.0) * 0.1;
    col -= scanline;
    
    // Grid pattern
    col *= 0.9 + 0.1 * sin(fragCoord.x * 2.0);
    
    // Fade edges (Vignette)
    float vign = pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.15);
    col *= vign;
    
    // Subtle flicker
    col *= 0.98 + 0.02 * sin(iTime * 120.0);
    
    fragColor = vec4(col, 1.0);
}
