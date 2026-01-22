/*
  TITLE          : CYBER RAIN
  -------------------------------------------------------------------------
  ALGORITHM      : Column-based Discrete Hash Stream (Matrix FX)
  IMPLEMENTATION : Independent column-velocity & hash-based selection
  -------------------------------------------------------------------------
*/

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.345, 67.891))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime;
    
    // Grid Setup
    float cols = 40.0;
    vec2 gv = vec2(uv.x * cols, uv.y);
    float colId = floor(gv.x);
    
    // Per-column speed and delay
    float speed = 0.5 + hash(vec2(colId)) * 1.5;
    float delay = hash(vec2(colId, 123.4)) * 5.0;
    
    // Falling Logic
    float yPos = fract(uv.y + t * speed + delay);
    
    // Character simulation (Digital noise)
    float charHeight = 25.0;
    float charId = floor(uv.y * charHeight - t * speed * charHeight);
    float charNoise = hash(vec2(colId, charId));
    
    // Tail / Fade effect
    float tail = pow(yPos, 4.0);
    
    // Color Palette (Cyber Green to Teal)
    vec3 baseCol = mix(vec3(0.0, 1.0, 0.4), vec3(0.0, 0.6, 1.0), uv.y);
    
    // Glow Core
    float head = smoothstep(0.98, 1.0, yPos);
    vec3 col = baseCol * tail;
    col += vec3(0.8, 1.0, 0.9) * head; // Bright falling head
    
    // Flicker & Character Detail
    col *= step(0.3, charNoise); // Some cells are empty
    col *= 0.8 + 0.2 * sin(t * 10.0 + colId); // Flicker
    
    // Scanline & Grid texture
    col *= 0.9 + 0.1 * sin(fragCoord.y * 1.5);
    col *= step(0.1, fract(gv.x)); // Vertical gaps

    fragColor = vec4(col, 1.0);
}
