/*
  TITLE          : FLUID CHROME
  -------------------------------------------------------------------------
  ALGORITHM      : Fluid Chrome - Iterative Domain Warping
  IMPLEMENTATION : Multi-octave FBM displacement & Specular lighting
  -------------------------------------------------------------------------
*/

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.345, 67.891))) * 43758.5453); }

float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), 
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i=0; i<4; i++) {
        v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * 0.3;
    
    // 1. Domain Warping for Fluid Motion
    vec2 q = vec2(fbm(p + t * 0.2), fbm(p + vec2(1.0)));
    vec2 r = vec2(fbm(p + q * 2.0 + t), fbm(p + q * 1.5 - t));
    float fluid = fbm(p + r);
    
    // 2. Normal Reconstruction (Pseudo-3D)
    float e = 0.01;
    float n1 = fbm(p + r + vec2(e, 0.0));
    float n2 = fbm(p + r + vec2(0.0, e));
    vec2 normal = normalize(vec2(n1 - fluid, n2 - fluid));
    
    // 3. Lighting Model
    vec3 lightDir = normalize(vec3(sin(t), cos(t), 1.0));
    vec3 viewDir = vec3(0, 0, 1);
    vec3 n3 = normalize(vec3(normal, 0.5));
    
    float diff = max(0.0, dot(n3, lightDir));
    float spec = pow(max(0.0, dot(reflect(-lightDir, n3), viewDir)), 32.0);
    float fresnel = pow(1.0 + dot(-viewDir, n3), 3.0);
    
    // Metallic Color Mapping
    vec3 baseCol = vec3(0.7, 0.75, 0.82); // Chrome base
    vec3 col = baseCol * (diff + 0.2) + spec * 0.8 + fresnel * vec3(0.2, 0.4, 0.8);
    
    // High-frequency "Reflection" glitter
    col += hash(normal * 10.0) * 0.05;
    
    // Contrast & Vignette
    col = pow(col, vec3(1.1));
    col *= 1.2 - length(p);

    fragColor = vec4(col, 1.0);
}
