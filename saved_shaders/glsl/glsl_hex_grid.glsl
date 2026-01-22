/*
  TITLE          : NEON HEX GRID
  -------------------------------------------------------------------------
  ALGORITHM      : Hexagonal Euclidean Distance Tiling
  IMPLEMENTATION : Manhattan-style coordinate quantization for hex-lattices
  -------------------------------------------------------------------------
*/

float hexDist(vec2 p) {
    p = abs(p);
    float c = dot(p, normalize(vec2(1.0, 1.73)));
    return max(c, p.x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * 0.5;
    
    uv *= 8.0;
    
    // Hexagonal tiling logic
    vec2 r = vec2(1.0, 1.73);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = length(a) < length(b) ? a : b;
    
    float d = hexDist(gv);
    vec2 id = uv - gv;
    
    // Pulse energy based on ID and Time
    float pulse = sin(t + length(id) * 0.2) * 0.5 + 0.5;
    pulse = pow(pulse, 3.0);
    
    // Color mapping (Deep Blue to Neon Cyan)
    vec3 baseCol = mix(vec3(0.0, 0.2, 0.5), vec3(0.0, 1.0, 0.8), pulse);
    
    // Grid Lines
    float line = smoothstep(0.48, 0.44, d) - smoothstep(0.44, 0.40, d);
    vec3 col = baseCol * line * (1.0 + pulse * 2.0);
    
    // Cell Glow
    col += baseCol * smoothstep(0.4, 0.0, d) * pulse * 0.5;
    
    // Final touch
    col *= 1.1 - length(uv * 0.1);

    fragColor = vec4(col, 1.0);
}
