/*
  TITLE          : CYBER TUNNEL
  -------------------------------------------------------------------------
  ALGORITHM      : Polar Coordinate Tunnel Mapping
  IMPLEMENTATION : Segmented distance-based texture simulation
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * 0.8;
    
    // Polar coordinates
    float d = length(uv);
    float a = atan(uv.y, uv.x) / (2.0 * 3.14159);
    
    // Tunnel projection
    float z = 1.0 / (d + 0.01);
    vec2 p = vec2(a * 4.0, z + t);
    
    // Segmented wall patterns
    float segments = step(0.1, fract(p.x * 2.0)) * step(0.1, fract(p.y * 5.0));
    float pulse = sin(p.y * 0.5 - t * 2.0) * 0.5 + 0.5;
    
    // Color Palette (Electric Purple to Cyan)
    vec3 col = mix(vec3(0.5, 0.0, 1.0), vec3(0.0, 1.0, 1.0), pulse);
    col *= segments * pulse;
    
    // Glow and depth
    col += vec3(0.2, 0.1, 0.4) * exp(-d * 2.0);
    col /= (d * 5.0); // Depth fade
    
    // Core light
    col += vec3(1.0, 0.9, 0.8) * smoothstep(0.1, 0.0, d);

    fragColor = vec4(col, 1.0);
}
