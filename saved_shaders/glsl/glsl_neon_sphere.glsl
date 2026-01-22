/*
  TITLE          : KINETIC NEON SPHERE
  -------------------------------------------------------------------------
  ALGORITHM      : Volumetric Raymarching with Dynamic SDF
  IMPLEMENTATION : Interactive uniforms & Orbital ring accumulation
  -------------------------------------------------------------------------
*/

// @uniform float speed = 0.5 (min: 0.1, max: 2.0)
// @uniform float glow_intensity = 1.0 (min: 0.2, max: 3.0)
// @uniform float complexity = 4.0 (min: 1.0, max: 10.0)
// @uniform vec3 color1 = #00ffff
// @uniform vec3 color2 = #ff00ff

mat2 rot2d(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float map(vec3 p) {
    float t = iTime * speed;
    vec3 p_rot = p;
    p_rot.xy *= rot2d(t * 0.3);
    p_rot.xz *= rot2d(t * 0.5);
    
    // Core deformed sphere
    float wave = sin(p_rot.x * complexity + t) * cos(p_rot.y * complexity + t);
    float sphere = length(p) - (1.2 + wave * 0.15);
    
    // Orbital rings
    vec3 p1 = p;
    p1.xy *= rot2d(t * 0.8);
    float ring1 = length(vec2(length(p1.xz) - 1.8, p1.y)) - 0.02;
    
    vec3 p2 = p;
    p2.yz *= rot2d(t * 0.6);
    float ring2 = length(vec2(length(p2.xy) - 2.1, p2.z)) - 0.02;
    
    return min(sphere, min(ring1, ring2));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec3 ro = vec3(0, 0, -5);
    vec3 rd = normalize(vec3(uv, 1.3));
    
    float t = 0.0;
    float glow = 0.0;
    float minDist = 100.0;
    
    for(int i = 0; i < 90; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        minDist = min(minDist, d);
        
        // Accumulate glow relative to distance to surface
        glow += 0.015 / (0.015 + d * d);
        
        if(d < 0.001 || t > 10.0) break;
        t += d * 0.7;
    }
    
    vec3 baseCol = mix(color1, color2, sin(iTime * speed * 0.5) * 0.5 + 0.5);
    
    // Subtle interior reveal
    vec3 col = vec3(0.0);
    if (t < 10.0) {
        col = baseCol * 0.2;
    }
    
    // High energy neon glow
    col += baseCol * glow * glow_intensity * 0.12;
    
    // Atmospheric center glow
    col += baseCol * exp(-length(uv) * 4.0) * 0.3;
    
    // Post-processing
    col = pow(col, vec3(0.9));
    col *= 1.1 - length(uv) * 0.5; // Soft vignette
    
    fragColor = vec4(col, 1.0);
}
