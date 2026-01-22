/*
  TITLE          : LIQUID RGB WARP
  -------------------------------------------------------------------------
  ALGORITHM      : Multi-octave Domain Warping (Liquid Effect)
  IMPLEMENTATION : Iterative sine/cosine coordinate displacement
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * 0.4;
    
    // Multi-layered warping
    for(float i=1.0; i<4.0; i++) {
        uv.x += 0.3 / i * sin(i * 3.0 * uv.y + t + i);
        uv.y += 0.3 / i * cos(i * 3.0 * uv.x + t + i);
    }
    
    // Vibrant Color Mapping
    vec3 col;
    col.r = 0.5 + 0.5 * sin(uv.x + t);
    col.g = 0.5 + 0.5 * sin(uv.y + t + 2.0);
    col.b = 0.5 + 0.5 * sin(uv.x + uv.y + t + 4.0);
    
    // Add specular highlight simulation
    float spec = pow(max(0.0, 1.0 - length(uv)), 3.0);
    col += spec * 0.4;

    // Darken edges
    col *= 1.0 - length(uv) * 0.5;

    fragColor = vec4(col, 1.0);
}
