/*
  TITLE          : ORGANIC SDF BLOB
  -------------------------------------------------------------------------
  ALGORITHM      : Raymarching Volumetric SDF
  IMPLEMENTATION : 3D Value Noise displacement with Fresnel/Lambertian shading
  -------------------------------------------------------------------------
*/

float hash(vec3 p) { return fract(sin(dot(p, vec3(12.345, 67.891, 45.123))) * 43758.5453); }

float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}

float map(vec3 p) {
    float d = length(p) - 1.2;
    float n = noise(p * 2.0 + iTime * 0.5);
    d += n * 0.3;
    d += noise(p * 5.0 - iTime) * 0.1;
    return d * 0.6; // Step down for accuracy
}

vec3 getNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
    vec3 ro = vec3(0, 0, -3.5);
    vec3 rd = normalize(vec3(uv, 2.0));

    float t = 0.0, d;
    for(int i=0; i<80; i++) {
        d = map(ro + rd * t);
        if(d < 0.001 || t > 10.0) break;
        t += d;
    }

    vec3 col = vec3(0.02, 0.04, 0.06); // Deep space background
    
    if(t < 10.0) {
        vec3 pos = ro + rd * t;
        vec3 nor = getNormal(pos);
        vec3 lightPos = vec3(2, 4, -3);
        vec3 li = normalize(lightPos - pos);
        
        // Lighting model
        float diff = max(0.0, dot(nor, li));
        float amb = 0.1;
        float fres = pow(1.0 + dot(rd, nor), 4.0);
        float spec = pow(max(0.0, dot(reflect(-li, nor), -rd)), 32.0);
        
        vec3 baseCol = mix(vec3(0.1, 0.4, 0.8), vec3(0.8, 0.2, 0.9), pos.y * 0.5 + 0.5);
        col = baseCol * (diff + amb) + spec * 0.8 + fres * vec3(0.5, 0.8, 1.0);
    }
    
    // Add volumetric glow
    col += vec3(0.1, 0.2, 0.4) * (1.0 / (1.0 + t * t * 0.1));
    
    // Post processing
    col = smoothstep(0.0, 1.0, col);
    col *= 1.1 - length(uv) * 0.4;

    fragColor = vec4(col, 1.0);
}
