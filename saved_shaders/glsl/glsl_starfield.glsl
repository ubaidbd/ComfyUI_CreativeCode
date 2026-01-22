/*
  TITLE          : INFINITE STARFIELD
  -------------------------------------------------------------------------
  ALGORITHM      : Depth-Layered Hash Projection
  IMPLEMENTATION : Fractional speed-mapping with exponential scale
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    vec3 col = vec3(0.0);
    float t = iTime * speed;
    
    for(float i=0.0; i<1.0; i+=0.1) {
        float depth = fract(i + t * 0.1);
        float scale = mix(20.0, 0.1, depth);
        vec2 p = uv * scale;
        vec2 id = floor(p);
        vec2 g = fract(p) - 0.5;
        
        float n = fract(sin(dot(id + i, vec2(12.9898, 78.233))) * 43758.5453);
        if(n > 0.9) {
            float brightness = smoothstep(0.1, 0.0, length(g));
            col += brightness * smoothstep(0.0, 0.2, depth) * smoothstep(1.0, 0.8, depth);
        }
    }
    
    fragColor = vec4(col, 1.0);
}
