/*
  TITLE          : NEON GLOW BOX
  -------------------------------------------------------------------------
  ALGORITHM      : Analytic 2D Box SDF
  IMPLEMENTATION : Distance-field glow attenuation with Fill-logic
  -------------------------------------------------------------------------
*/
float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord*2.0-iResolution.xy)/iResolution.y;

    vec3 col = vec3(0.1);
    
    // Rotate
    float t = iTime;
    mat2 rot = mat2(cos(t), -sin(t), sin(t), cos(t));
    vec2 p = rot * uv;
    
    // Box
    float d = sdBox(p, vec2(0.5, 0.3));
    
    // Glow
    float glow = 0.05 / abs(d);
    
    col = vec3(glow * 0.2, glow * 0.8, glow);
    
    // Fill
    if (d < 0.0) col += vec3(0.0, 0.3, 0.4);

    fragColor = vec4(col,1.0);
}
