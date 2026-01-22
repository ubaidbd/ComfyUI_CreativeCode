/*
  TITLE          : DOT GRID
  -------------------------------------------------------------------------
  ALGORITHM      : Fract-based Spatial Partitioning
  IMPLEMENTATION : Synchronized sinusoidal scale modulation
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float col = 0.0;
    vec2 g = floor(uv * 10.0);
    vec2 f = fract(uv * 10.0) - 0.5;
    float m = sin(iTime + g.x * 0.5 + g.y * 0.5) * 0.5 + 0.5;
    col = step(0.4 * m, length(f));
    fragColor = vec4(vec3(1.0 - col) * vec3(0.1, 0.8, 0.5), 1.0);
}
