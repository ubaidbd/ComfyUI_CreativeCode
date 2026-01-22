/*
  TITLE          : SOFT AURORA
  -------------------------------------------------------------------------
  ALGORITHM      : Domain Warping via Sine-Cos harmonics
  IMPLEMENTATION : Dynamic length-based color mixing
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime * 0.2;
    vec2 q = vec2(sin(uv.x + uv.y + t), cos(uv.x - uv.y + t));
    vec2 r = vec2(sin(uv.x + q.x + t * 0.5), cos(uv.y + q.y + t * 0.3));
    float f = sin(length(uv + r) * 12.0);
    vec3 col = mix(vec3(0.05, 0.1, 0.3), vec3(0.0, 0.9, 0.8), f);
    col += mix(vec3(0.4, 0.0, 0.2), vec3(0.1, 0.0, 0.1), q.y);
    fragColor = vec4(col * (1.2 - length(uv)), 1.0);
}
