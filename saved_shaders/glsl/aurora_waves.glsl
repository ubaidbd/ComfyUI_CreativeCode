/*
  TITLE          : AURORA WAVES
  -------------------------------------------------------------------------
  ALGORITHM      : Multi-layered Perlin Noise Aurora
  IMPLEMENTATION : FBM-driven coordinate warping (Domain Warping)
  -------------------------------------------------------------------------
*/

float hash(vec2 n) { return fract(sin(dot(n, vec2(12.345, 67.891))) * 43758.5453123); }

float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= iResolution.x / iResolution.y;

    float t = iTime * 0.2;
    
    // Aurora Layers
    vec3 col = vec3(0.01, 0.02, 0.05); // Deep night sky
    
    for(float i=1.0; i<4.0; i++) {
        float speed = t * (0.5 + i * 0.1);
        vec2 uv2 = p * 0.5;
        uv2.y += fbm(vec2(p.x * 0.5 + speed, speed)) * 0.5;
        
        float shape = smoothstep(0.1, 0.5, fbm(uv2 * 2.0 + speed));
        shape *= smoothstep(0.8, 0.2, abs(p.y + 0.2 * i)); // Ribbon limit
        
        vec3 aCol = mix(vec3(0.1, 0.8, 0.4), vec3(0.5, 0.2, 0.9), sin(t + i) * 0.5 + 0.5);
        if(i > 2.0) aCol = mix(aCol, vec3(1.0, 0.2, 0.5), 0.5); // Add pink to top layer
        
        col += aCol * shape * (0.6 / i);
    }
    
    // Stars
    float s = hash(uv * 500.0);
    if(s > 0.998) col += vec3(0.8, 0.9, 1.0) * hash(uv * 10.0);

    // Final Atmos
    col *= 1.0 - length(p * 0.5) * 0.5; // Vignette
    col = pow(col, vec3(0.8)); // Gamma correction
    
    fragColor = vec4(col, 1.0);
}
