/*
  TITLE          : JULIA FRACTAL ORBIT
  -------------------------------------------------------------------------
  ALGORITHM      : Fractal Julia Set with Smooth Iteration Count
  IMPLEMENTATION : Orbit Trapping with exponential distance attenuation
  -------------------------------------------------------------------------
*/

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime * 0.1;
    
    // Zoom & Pan orbit
    uv *= 2.5 + sin(t) * 1.5;
    uv += vec2(sin(t * 0.5), cos(t * 0.3)) * 0.5;

    vec2 c = vec2(-0.8, 0.156) + vec2(cos(t * 1.2), sin(t)) * 0.05;
    vec2 z = uv;
    
    float iter = 0.0;
    float minDist = 1e5; // Orbit trap
    
    for(int i=0; i<80; i++) {
        z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
        
        // Orbit trap (distance to a point/line)
        minDist = min(minDist, length(z - vec2(sin(t), cos(t))));
        
        if(length(z) > 4.0) break;
        iter++;
    }

    // Smooth coloring math
    float smoothIter = iter - log2(log2(dot(z,z))) + 4.0;
    
    // Color palette mapping
    vec3 col = 0.5 + 0.5 * cos(3.0 + smoothIter * 0.2 + vec3(0.0, 0.6, 1.2));
    
    // Mix orbit trap for extra detail
    col = mix(col, vec3(1.0, 0.8, 0.4), exp(-5.0 * minDist));
    
    // Vignette & Contrast
    col *= 1.2 - length(uv * 0.3);
    col = pow(col, vec3(1.1));

    fragColor = vec4(col, 1.0);
}
