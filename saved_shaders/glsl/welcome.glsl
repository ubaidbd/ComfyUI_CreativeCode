/*
  CREATIVE CODE - READY TO CREATE
  -------------------------------------------------------------------------
  Explore the "Shader Library" to load curated GLSL and p5.js examples.
  -------------------------------------------------------------------------
  POWER USER GUIDE: INTERACTIVE UNIFORMS
  By adding '// @uniform' comments, you instantly generate UI controls:
  
  // @uniform name = default_value      -> Creates a Slider
  // @uniform color = #hex             -> Creates a Color Picker
  // @uniform toggle = true            -> Creates a Switch
  
  Note: You must also declare 'uniform type name;' in your GLSL code.
  -------------------------------------------------------------------------
*/

// --- INTERACTIVE SHOWCASE CONTROLS ---
// @uniform bg_speed = 1.0
// @uniform nebula_intensity = 0.5
// @uniform text_glow = 1.2
// @uniform chromatic_amt = 0.02
// @uniform grid_opacity = 0.1
// @uniform accent_color = #00d5ff

uniform float bg_speed;
uniform float nebula_intensity;
uniform float text_glow;
uniform float chromatic_amt;
uniform float grid_opacity;
uniform vec3 accent_color;

#define PI 3.14159265359

// --- GLYPH ENGINE (Simplified) ---
// R, E, A, D, Y, T, O, C
// 12, 4, 1, 3, 18, 14, 11, 2
float line(vec2 p, vec2 a, vec2 b, float th) {
    vec2 pa = p-a, ba = b-a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h) - th;
}
float segH(vec2 p, float y, float x0, float x1, float th){ return line(p, vec2(x0,y), vec2(x1,y), th); }
float segV(vec2 p, float x, float y0, float y1, float th){ return line(p, vec2(x,y0), vec2(x,y1), th); }

float glyph(vec2 p, int c){
    float th = 0.05;
    float d = 1e5;
    if(c==0) return 1e5; // Space
    
    // A=1, C=2, D=3, E=4, O=11, R=12, T=14, Y=18
    if(c==1){ // A
        d = min(d, segV(p, -0.3, -0.4, 0.4, th)); d = min(d, segV(p, 0.3, -0.4, 0.4, th));
        d = min(d, segH(p, 0.0, -0.3, 0.3, th)); d = min(d, segH(p, 0.4, -0.2, 0.2, th));
    } else if(c==2){ // C
        d = min(d, segH(p, 0.4, -0.3, 0.3, th)); d = min(d, segH(p, -0.4, -0.3, 0.3, th));
        d = min(d, segV(p, -0.3, -0.4, 0.4, th));
    } else if(c==3){ // D
        d = min(d, segV(p, -0.3, -0.4, 0.4, th));
        d = min(d, line(p, vec2(-0.3,0.4), vec2(0.2,0.4), th)); d = min(d, line(p, vec2(-0.3,-0.4), vec2(0.2,-0.4), th));
        d = min(d, line(p, vec2(0.2,0.4), vec2(0.3,0.2), th)); d = min(d, line(p, vec2(0.3,0.2), vec2(0.3,-0.2), th));
        d = min(d, line(p, vec2(0.3,-0.2), vec2(0.2,-0.4), th));
    } else if(c==4){ // E
        d = min(d, segV(p, -0.3, -0.4, 0.4, th)); d = min(d, segH(p, 0.4, -0.3, 0.3, th));
        d = min(d, segH(p, 0.0, -0.3, 0.1, th)); d = min(d, segH(p, -0.4, -0.3, 0.3, th));
    } else if(c==11){ // O
        d = min(d, segH(p, 0.4, -0.2, 0.2, th)); d = min(d, segH(p, -0.4, -0.2, 0.2, th));
        d = min(d, segV(p, -0.3, -0.3, 0.3, th)); d = min(d, segV(p, 0.3, -0.3, 0.3, th));
    } else if(c==12){ // R
        d = min(d, segV(p, -0.3, -0.4, 0.4, th)); d = min(d, segH(p, 0.4, -0.3, 0.2, th));
        d = min(d, segH(p, 0.1, -0.3, 0.2, th)); d = min(d, segV(p, 0.3, 0.1, 0.4, th));
        d = min(d, line(p, vec2(0.0,0.1), vec2(0.3,-0.4), th));
    } else if(c==14){ // T
        d = min(d, segH(p, 0.4, -0.3, 0.3, th)); d = min(d, segV(p, 0.0, -0.4, 0.4, th));
    } else if(c==18){ // Y
        d = min(d, line(p, vec2(-0.3,0.4), vec2(0.0,0.0), th)); d = min(d, line(p, vec2(0.3,0.4), vec2(0.0,0.0), th));
        d = min(d, segV(p, 0.0, -0.4, 0.0, th));
    }
    return d;
}

float place(vec2 p, float x, float y, int c){ return glyph(p - vec2(x, y), c); }

float msgSet(vec2 p, float t) {
    float adv = 0.9; 
    float d = 1e5;
    
    // READY TO CREATE
    // Characters: 12, 4, 1, 3, 18, 0, 14, 11, 0, 2, 12, 4, 1, 14, 4
    int m[15] = int[](12,4,1,3,18,0,14,11,0,2,12,4,1,14,4);
    
    float startX = -6.5;
    for(int i=0; i<15; i++) {
        float xPos = startX + float(i) * adv;
        float yPos = sin(t * 2.0 + xPos * 0.5) * 0.15; // Wave effect
        d = min(d, place(p, xPos, yPos, m[i]));
    }
    
    return d;
}

// --- NOISE ---
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    float t = iTime;

    // --- BACKGROUND ---
    vec3 col = vec3(0.02, 0.02, 0.04);
    
    // Moving nebula
    vec2 p2 = uv * 2.0;
    float n = fbm(p2 + vec2(t * 0.1 * bg_speed, 0.0));
    vec3 nebula = vec3(0.1, 0.3, 0.6) * n * nebula_intensity;
    col += nebula;

    // --- TEXT ---
    vec2 textUV = uv * 14.0; // Scale text space
    
    // Chromatic Aberration
    float ca = chromatic_amt;
    float dR = msgSet(textUV + vec2(ca, 0), t);
    float dG = msgSet(textUV, t);
    float dB = msgSet(textUV - vec2(ca, 0), t);
    
    vec3 textCol = vec3(0);
    // Reduced glow power significantly
    float glow = text_glow * (0.05 + 0.05 * sin(t * 4.0)); 
    
    // SDF rendering: Crisp text core + subtle glow
    // Smoothstep creates the sharp letter form
    float coreR = 1.0 - smoothstep(0.0, 0.1, dR);
    float coreG = 1.0 - smoothstep(0.0, 0.1, dG);
    float coreB = 1.0 - smoothstep(0.0, 0.1, dB);
    
    // Glow calculation based on distance
    float glowR = glow / (abs(dR) + 0.1);
    float glowG = glow / (abs(dG) + 0.1);
    float glowB = glow / (abs(dB) + 0.1);
    
    textCol.r = coreR + glowR;
    textCol.g = coreG + glowG;
    textCol.b = coreB + glowB;
    
    col += textCol;

    // --- POST FX ---
    // Grid
    float grid = (step(0.95, fract(uv.x * 8.0)) + step(0.95, fract(uv.y * 8.0))) * grid_opacity;
    col += grid * accent_color;
    
    // Vignette
    col *= 1.2 - length(uv) * 0.6;
    
    fragColor = vec4(col, 1.0);
}
