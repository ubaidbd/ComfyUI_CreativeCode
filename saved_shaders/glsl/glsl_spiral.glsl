/*
  TITLE          : HYPNOTIC SPIRAL
  -------------------------------------------------------------------------
  ALGORITHM      : Polar Coordinate Logarithmic Spiral
  IMPLEMENTATION : High-contrast smoothstep color partitioning
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float angle = atan(uv.y, uv.x);
    float r = length(uv);
    float spiral = sin(10.0 * r - iTime * 4.0 + angle * 3.0);
    vec3 col = mix(vec3(0,0,0), vec3(0.8, 0.2, 1.0), smoothstep(0.0, 0.2, spiral));
    col += mix(vec3(0), vec3(0, 0.8, 0.9), smoothstep(0.0, -0.2, spiral));
    fragColor = vec4(col / (r + 0.1), 1.0);
}
