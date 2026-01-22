/*
  TITLE          : GLASS REFRACTION
  -------------------------------------------------------------------------
  ALGORITHM      : Patterned Glass Refraction with Chromatic Aberration
  IMPLEMENTATION : Voronoi-based spatial partitioning & Spectral offsets
  -------------------------------------------------------------------------
*/

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

float voronoi(vec2 p) {
    vec2 n = floor(p); vec2 f = fract(p);
    float md = 8.0;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(n + g);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md) md = d;
    }
    return sqrt(md);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float t = iTime * 0.2;
    
    // 1. Generate Glass Normals from Voronoi Pattern
    vec2 vUV = uv * 6.0;
    float v1 = voronoi(vUV);
    float v2 = voronoi(vUV + vec2(0.01, 0.0));
    float v3 = voronoi(vUV + vec2(0.0, 0.01));
    
    vec2 normal = normalize(vec2(v2 - v1, v3 - v1));
    
    // 2. Chromatic Aberration Refraction
    float refraction = 0.04;
    vec3 col;
    col.r = texture(iChannel0, uv + normal * refraction).r;
    col.g = texture(iChannel0, uv + normal * refraction * 0.8).g;
    col.b = texture(iChannel0, uv + normal * refraction * 0.6).b;
    
    // 3. Fresnel & Lighting
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 n3 = normalize(vec3(normal, 0.5));
    float fresnel = pow(1.0 + dot(-viewDir, n3), 3.0);
    
    // Specular highlight
    vec3 lightDir = normalize(vec3(sin(t), cos(t), 1.0));
    float spec = pow(max(0.0, dot(reflect(-lightDir, n3), viewDir)), 16.0);
    
    col = mix(col, vec3(1.0), fresnel * 0.3); // Edge reflection
    col += spec * 0.5; // Specular burst
    
    // 4. Subtle Tinting & Vignette
    col *= vec3(0.95, 1.0, 1.05); // Glass-like blue tint
    col *= 1.2 - length(uv - 0.5) * 0.5;
    
    fragColor = vec4(col, 1.0);
}
