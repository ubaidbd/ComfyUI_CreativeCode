# ComfyUI CreativeCode

A unified environment for writing GLSL and p5.js directly in ComfyUI. This node provides a full-featured code editor (Monaco) with syntax highlighting, auto-complete, and real-time previewing.
Key features include an integrated shader library, error tracking with line mapping, local AI code assistance (via Ollama), and automatic UI generation for shader uniforms.

| | |
| :---: | :---: |
| <video src="https://github.com/user-attachments/assets/2afc7162-a060-49bf-98c7-34b245d16760" width="100%" autoplay loop muted playsinline></video> | <video src="https://github.com/user-attachments/assets/f90da2bb-c557-4725-9853-b9dfa4b003f6" width="100%" autoplay loop muted playsinline></video> |

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/SKBv0/ComfyUI_CreativeCode.git
pip install -r ComfyUI_CreativeCode/requirements.txt
```

Restart ComfyUI.

## Nodes

### CreativeCode Code2Vid
The main node for writing code and rendering.
- **Inputs:**
  - `settings` (Optional): Share settings from a Settings node.
  - `channels` (Optional): Connect external images/textures.
- **Outputs:**
  - `IMAGE`: Rendered frames.
  - `STRING`: The source code.

### CreativeCode Settings
Use this to store configuration (width, height, fps) separately and share it across multiple render nodes.

### CreativeCode Channels
Allows connecting external images to be used as textures (`iChannel0-3`).

## Code Types

### GLSL (Shaders)
ShaderToy-compatible syntax. Runs on the GPU via ModernGL backend.

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}
```

**Available Uniforms:**
- `iResolution` (vec3): Viewport resolution.
- `iTime` (float): Playback time in seconds.
- `iFrame` (int): Current frame number.
- `iMouse` (vec4): Mouse position.
- `iChannel0-3` (sampler2D): Input textures.

### p5.js
JavaScript-based creative coding. Runs in the browser; frames are captured via "Bake Animation".

```javascript
function setup() {
    createCanvas(400, 400);
}

function draw() {
    background(30);
    fill(255, 100, 100);
    ellipse(mouseX, mouseY, 50, 50);
}
```

> **Note:** When using p5.js, the node automatically captures frames from the browser when you run the queue. You can also manually click **"BAKE ANIMATION"** to inspect the captured frames beforehand.

## Interactive Uniforms

Add sliders and color pickers to the UI by adding special comments in your code:

```glsl
// @uniform float speed = 1.0 (min: 0.0, max: 5.0)
// @uniform vec3 color = #ff0000
```

These will appear in the "Detected Uniforms" panel.

## Using Textures

Images connected via the **Channels** node can be accessed as follows:

**GLSL:**
```glsl
vec4 tex = texture(iChannel0, uv);
```

**p5.js:**
```javascript
// Access the p5.Image object directly
image(iChannel0, 0, 0);
```

## Configuration & Troubleshooting

Please refer to [HOW_TO_USE.md](HOW_TO_USE.md) for detailed configuration options (including Memory Limits) and troubleshooting steps.

---

