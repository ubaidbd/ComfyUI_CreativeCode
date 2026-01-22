/*
  TITLE          : WARPED GRID
  -------------------------------------------------------------------------
  ALGORITHM      : Orthogonal Sinusoidal Distortion
  IMPLEMENTATION : Checkerboard partitioning via floor-mod logic
  -------------------------------------------------------------------------
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord.xy / iResolution.xy;
    vec2 uv = p;
    
    // Distort UVs
    uv.x += sin(uv.y * 10.0 + iTime) * 0.05;
    uv.y += cos(uv.x * 10.0 + iTime) * 0.05;

    // Checkerboard
    vec2 c = floor(uv * 10.0);
    float check = mod(c.x + c.y, 2.0);
    
    vec3 col = mix(vec3(0.1, 0.0, 0.2), vec3(0.9, 0.4, 0.6), check);
    
    // Vignette
    float vig = 1.0 - length(p - 0.5);
    col *= vig;
    
    fragColor = vec4(col, 1.0);
}
