# How to Use

## Quick Start

1. Add **CreativeCode Code2Vid** node from the menu.
2. Write code in the editor (GLSL or p5.js).
3. View the result in the Preview window.
4. Click **Queue Prompt** to render.

## Writing GLSL Shaders

A simple gradient:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv.x, uv.y, 0.5, 1.0);
}
```

Animated:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    fragColor = vec4(col, 1.0);
}
```

## Writing p5.js Sketches

```javascript
function setup() {
    createCanvas(400, 400);
}

function draw() {
    background(20);

    // Rotating circle in the center
    translate(width/2, height/2);
    rotate(frameCount * 0.02);

    fill(255, 100, 150);
    ellipse(100, 0, 50, 50);
}
```

**Note:** The animation is automatically baked (captured) when you run the queue.

## Adding Sliders (Uniforms)

Define uniforms in your code using comments:

```glsl
// @uniform float speed = 1.0
// @uniform float size = 0.5
// @uniform vec3 baseColor = #3366ff

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float d = length(uv - 0.5);
    float circle = smoothstep(size, size - 0.01, d);
    vec3 col = baseColor * circle;
    col += 0.5 + 0.5 * sin(iTime * speed);
    fragColor = vec4(col, 1.0);
}
```

Sliders/Color pickers will automatically appear in the "Detected Uniforms" panel.

## Using Textures

1. Add a **Channels** node.
2. Connect an image (LoadImage, etc.).
3. Connect the output of Channels to the Code2Vid node.

Usage in Shader:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 tex = texture(iChannel0, uv);
    fragColor = tex;
}
```

## Sharing Settings

To apply the same settings to multiple render nodes:

1. Add a **Settings** node.
2. Configure code, resolution, etc.
3. Connect the Settings output to your Code2Vid nodes.

## Tips

- The preview works in real-time and updates as you type.
- You can copy code from ShaderToy; most of it works out of the box.
- The `t` variable is available as a shortcut for `iTime`.
- Errors are displayed with line numbers directly in the editor.

## Common Issues

### Preview works but render fails
There are minor differences between WebGL2 (Browser) and ModernGL (Python Backend). Try these:
- Remove the `#version` line if present.
- Use `texture()` instead of `texture2D()`.
- Use `fragColor` output instead of `gl_FragColor`.

### p5.js animation has missing frames
- Check the frame count in Settings.
- Do not click Queue Prompt until the "Baking" process is complete.

### Out of Memory Error
- Reduce output resolution.
- Reduce frame count.
- The default limit is safe for ~100 HD frames (can be increased in `nodes.py`).

## Limits & Configuration

### Memory Limit (207M Pixels)
To prevent System RAM overload and crashes (OOM), this node enforces a safeguard limit on the total number of pixels processed in a single batch.

**Default Limit:** ~207 Million Pixels  
*Example:* 1920x1080 resolution x 100 frames.

**Why does this exist?**
Processing raw uncompressed video tensors consumes significant RAM. A batch exceeding this limit could easily require >3GB of contiguous RAM, potentially crashing ComfyUI.

**How to increase it?**
If you have a high-RAM system and need to render larger batches:
1. Open `nodes.py` in the `ComfyUI_CreativeCode` folder.
2. Locate the line:
   ```python
   MAX_TOTAL_PIXELS = 1920 * 1080 * 100
   ```
3. Increase the value to your desired limit.
4. Restart ComfyUI.

## AI Assistant

If you have Ollama installed and running, the AI Assistant panel becomes active. Describe your shader, and the AI will suggest fixes or additions.

Example prompts:
- "Add glow effect"
- "Make it spin faster"
- "Fix this error: ..."
