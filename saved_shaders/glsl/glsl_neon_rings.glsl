/*
  TITLE          : NEON GLOW RINGS
  -------------------------------------------------------------------------
  ALGORITHM      : Analytic Distance-to-Circle (Euclidean)
  IMPLEMENTATION : 1/d glow attenuation with multi-spectral mixing
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= iResolution.x / iResolution.y;
    float d = length(p);
    float glow = 0.02 / abs(0.5 - d);
    vec3 col = mix(vec3(0,0,0), vec3(1, 0.4, 0.1), glow);
    col += mix(vec3(0), vec3(0.5, 0.1, 0.9), 0.01 / abs(0.3 - d));
    fragColor = vec4(col, 1.0);
}
