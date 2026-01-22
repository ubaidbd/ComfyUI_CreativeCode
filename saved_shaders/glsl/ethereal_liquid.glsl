/*
  TITLE          : ETHEREAL LIQUID
  -------------------------------------------------------------------------
  ALGORITHM      : Sinusoidal UV Warping
  IMPLEMENTATION : Multi-frequency chromatic aberration & vignette
  -------------------------------------------------------------------------
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // 1. Setup coordinates
    vec2 uv = fragCoord/iResolution.xy;
    
    // 2. Time variable (slowed down)
    float t = iTime * 0.5;
    
    // 3. Liquid Distortion
    // Shift UV coordinates with sine waves
    vec2 distortion = vec2(
        sin(uv.y * 5.0 + t) * 0.02 + sin(uv.x * 10.0 + t * 0.5) * 0.01,
        cos(uv.x * 5.0 + t) * 0.02 + cos(uv.y * 10.0 + t * 0.3) * 0.01
    );
    
    // 4. Chromatic Aberration
    // Add depth by sampling RGB channels from slightly different positions
    float r = texture(iChannel0, uv + distortion + vec2(0.005, 0.0)).r;
    float g = texture(iChannel0, uv + distortion).g;
    float b = texture(iChannel0, uv + distortion - vec2(0.005, 0.0)).b;
    
    vec3 col = vec3(r, g, b);
    
    // 5. Cinematic Color Grading
    // Increase contrast and add a subtle purple/blue atmosphere
    col = pow(col, vec3(1.2)); // Contrast
    col = mix(col, vec3(0.1, 0.0, 0.2), 0.1); // Atmosphere
    
    // 6. Vignette (Edge darkening)
    float vignette = 1.0 - smoothstep(0.5, 1.5, length(uv - 0.5) * 1.5);
    col *= vignette;

    fragColor = vec4(col, 1.0);
}
