import hashlib
import json
import os
from collections import OrderedDict
from typing import List, Optional

import threading
import numpy as np
import torch

import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHADERS_DIR = os.path.join(BASE_DIR, "saved_shaders")
P5_CACHE_DIR = os.path.join(BASE_DIR, "p5_cache")

# Auto-cleanup P5 cache
def cleanup_old_p5_cache(max_age_seconds: int = 3600):
    if not os.path.exists(P5_CACHE_DIR):
        return
    try:
        now = time.time()
        for item in os.listdir(P5_CACHE_DIR):
            cache_path = os.path.join(P5_CACHE_DIR, item)
            if os.path.isdir(cache_path):
                mtime = os.path.getmtime(cache_path)
                if now - mtime > max_age_seconds:
                    import shutil
                    shutil.rmtree(cache_path, ignore_errors=True)
                    print(f"[CreativeCode] Cleaned up old P5 cache: {item}")
    except Exception as e:
        print(f"[CreativeCode] Cache cleanup error: {e}")

cleanup_old_p5_cache()

def get_available_shaders():
    shaders = ["None"]
    if not os.path.exists(SHADERS_DIR):
        return shaders
        
    for f in os.listdir(SHADERS_DIR):
        if f.endswith(".js") or f.endswith(".glsl"):
            shaders.append(f)
            
    glsl_dir = os.path.join(SHADERS_DIR, "glsl")
    if os.path.exists(glsl_dir):
        for f in os.listdir(glsl_dir):
            if f.endswith(".glsl"):
                shaders.append(f"glsl/{f}")

    p5_dir = os.path.join(SHADERS_DIR, "p5")
    if os.path.exists(p5_dir):
        for f in os.listdir(p5_dir):
            if f.endswith(".js"):
                shaders.append(f"p5/{f}")
                
    return sorted(shaders)

_HAS_MODERNGL = False
try:
    import moderngl
    _HAS_MODERNGL = True
except ImportError:
    _HAS_MODERNGL = False

# Load default shader from file
DEFAULT_SHADER_PATH = os.path.join(SHADERS_DIR, "glsl", "welcome.glsl")
if os.path.exists(DEFAULT_SHADER_PATH):
    try:
        with open(DEFAULT_SHADER_PATH, "r", encoding="utf-8") as f:
            DEFAULT_SHADER = f.read()
    except Exception as e:
        print(f"[CreativeCode] Error loading default shader: {e}")
        DEFAULT_SHADER = "// Error loading default shader"
else:
    DEFAULT_SHADER = "// Default shader file not found"


class CreativeCodeGPU:
    def __init__(self):
        self.ctx = None
        self.vbo = None
        self.program_cache = OrderedDict()
        self.max_cache_size = 100
        self.color_tex = None
        self.fbo = None
        self.current_size = (0, 0)
        self.channel_textures = [None] * 4
        self.lock = threading.Lock()

    def _ensure_context(self, width: int, height: int) -> None:
        if self.ctx is None:
            self.ctx = moderngl.create_standalone_context()
            vertices = np.array(
                [
                    -1.0, -1.0,
                    1.0, -1.0,
                    -1.0, 1.0,
                    1.0, 1.0,
                ],
                dtype="f4",
            )
            self.vbo = self.ctx.buffer(vertices.tobytes())

        if self.current_size != (width, height):
            self._release_framebuffer()
            self.color_tex = self.ctx.texture((width, height), 4)
            self.color_tex.filter = (moderngl.LINEAR, moderngl.LINEAR)
            self.fbo = self.ctx.framebuffer(color_attachments=[self.color_tex])
            self.current_size = (width, height)

    def _release_framebuffer(self) -> None:
        if self.fbo is not None:
            self.fbo.release()
            self.fbo = None
        if self.color_tex is not None:
            self.color_tex.release()
            self.color_tex = None

    def _detect_code_type(self, code: str) -> str:
        import re
        code_lower = code.lower()

        p5_patterns = [
            r'\bfunction\s+setup\s*\(',
            r'\bfunction\s+draw\s*\(',
            r'\bvoid\s+setup\s*\(',
            r'\bvoid\s+draw\s*\(',
            r'\bcreateCanvas\s*\(',
            r'\bbackground\s*\(',
            r'\blet\s+\w+\s*=',
            r'\bconst\s+\w+\s*=',
        ]

        for pattern in p5_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return "p5"

        glsl_patterns = [
            r'\bvoid\s+mainImage\s*\(',
            r'#version\s+\d+',
            r'\buniform\s+\w+\s+\w+',
            r'\bvec[234]\s+\w+',
            r'\bfloat\s+\w+\s*=',
            r'\bfragColor\s*=',
            r'\bgl_FragColor\s*=',
        ]

        for pattern in glsl_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return "glsl"

        return "glsl"

    def _normalize_code(self, code: str) -> str:
        lines = []
        for line in code.splitlines():
            stripped = line.strip()
            if stripped.startswith("#version"):
                continue
            if stripped.startswith("precision "):
                continue
            lines.append(line)
        code = "\n".join(lines)
        code = code.replace("texture2D", "texture")
        code = code.replace("gl_FragColor", "fragColor")
        return code

    def _build_vertex_shader(self, version_mode: str = "auto") -> str:
        if version_mode == "es300":
            return """#version 300 es
in vec2 in_pos;
void main() {
    gl_Position = vec4(in_pos, 0.0, 1.0);
}
"""
        else:
            return """#version 330
in vec2 in_pos;
void main() {
    gl_Position = vec4(in_pos, 0.0, 1.0);
}
"""

    def _wrap_shadertoy(self, code: str, version_mode: str = "auto") -> str:
        normalized = self._normalize_code(code)
        has_main_image = "mainImage" in normalized
        has_main = "void main" in normalized

        if not has_main_image and not has_main:
            normalized = (
                "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n"
                + normalized
                + "\\n}"
            )
            has_main_image = True

        header_version = "#version 330"
        if version_mode == "es300":
            header_version = "#version 300 es"
        elif version_mode == "auto":
            header_version = "#version 330"

        header = f"""{header_version}
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform float iFrameRate;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
out vec4 fragColor;
"""
        if has_main_image:
            return (
                header
                + normalized
                + "\nvoid main() {\n"
                + "    vec4 color = vec4(0.0);\n"
                + "    mainImage(color, gl_FragCoord.xy);\n"
                + "    fragColor = color;\n"
                + "}\n"
            )

        return header + normalized

    def _set_custom_uniforms(self, program, custom_uniforms: dict):
        if not custom_uniforms:
            return
        for name, value in custom_uniforms.items():
            if name not in program:
                continue
            try:
                uniform = program[name]
                if isinstance(value, (list, tuple)):
                    normalized = tuple(float(v) for v in value)
                    uniform.value = normalized if len(normalized) > 1 else normalized[0]
                elif isinstance(value, bool):
                    uniform.value = 1.0 if value else 0.0
                else:
                    uniform.value = float(value)
            except Exception:
                continue

    def _update_channel_textures(self, channels: List[Optional[torch.Tensor]], frame_idx: int, 
                                wrap_mode: str = "repeat", filter_mode: str = "linear"):
        for i, img_tensor in enumerate(channels):
            if self.channel_textures[i] is not None:
                self.channel_textures[i].release()
                self.channel_textures[i] = None
            
            if img_tensor is None:
                continue

            batch_size = img_tensor.shape[0]
            t_idx = frame_idx % batch_size
            
            frame = img_tensor[t_idx]
            frame = frame.flip(0) # Flip for GL
            h, w, c = frame.shape
            
            data = (frame * 255).byte().cpu().numpy().tobytes()
            tex = self.ctx.texture((w, h), c, data)
            
            if filter_mode == "nearest":
                tex.filter = (moderngl.NEAREST, moderngl.NEAREST)
            else:
                tex.filter = (moderngl.LINEAR, moderngl.LINEAR)

            if wrap_mode == "clamp":
                tex.repeat_x = False
                tex.repeat_y = False
            elif wrap_mode == "mirror":
                try:
                    tex.wrap_x = moderngl.MIRRORED_REPEAT
                    tex.wrap_y = moderngl.MIRRORED_REPEAT
                except AttributeError:
                    tex.repeat_x = True
                    tex.repeat_y = True
            else:
                tex.repeat_x = True
                tex.repeat_y = True

            tex.use(location=i)
            self.channel_textures[i] = tex

    def _get_program(self, code: str, version_mode: str = "auto"):
        key_source = f"{version_mode}:{code}"
        code_key = hashlib.sha1(key_source.encode("utf-8")).hexdigest()
        if code_key in self.program_cache:
            self.program_cache.move_to_end(code_key)
            return self.program_cache[code_key]

        vertex = self._build_vertex_shader(version_mode)
        fragment = self._wrap_shadertoy(code, version_mode)
        program = self.ctx.program(vertex_shader=vertex, fragment_shader=fragment)

        if len(self.program_cache) >= self.max_cache_size:
            self.program_cache.popitem(last=False)

        self.program_cache[code_key] = program
        return program


    def render(
        self,
        code: str,
        width: int,
        height: int,
        frame_count: int,
        fps: float,
        time_start: float,
        version_mode: str = "auto",
        custom_uniforms: Optional[dict] = None,
        channels: List[Optional[torch.Tensor]] = [None, None, None, None],
        texture_wrap: str = "repeat",
        texture_filter: str = "linear",
    ) -> torch.Tensor:
        with self.lock:
            return self._render_internal(
                code, width, height, frame_count, fps, time_start, version_mode, custom_uniforms, channels, texture_wrap, texture_filter
            )

    def _render_internal(
        self,
        code: str,
        width: int,
        height: int,
        frame_count: int,
        fps: float,
        time_start: float,

        version_mode: str,
        custom_uniforms: dict,
        channels: List[Optional[torch.Tensor]] = [None, None, None, None],
        texture_wrap: str = "repeat",
        texture_filter: str = "linear",
    ) -> torch.Tensor:
        self._ensure_context(width, height)
        program = self._get_program(code, version_mode)
        custom_uniforms = custom_uniforms or {}
        
        for i in range(4):
            if f"iChannel{i}" in program:
                program[f"iChannel{i}"].value = i

        vao = self.ctx.vertex_array(program, [(self.vbo, "2f", "in_pos")])
        self.fbo.use()


        frames_tensor = torch.empty((frame_count, height, width, 3), dtype=torch.float32)
        safe_fps = max(float(fps), 1.0)
        dt = 1.0 / safe_fps

        try:
            for i in range(frame_count):
                t = float(time_start) + (i * dt)
                if "iResolution" in program:
                    program["iResolution"].value = (float(width), float(height), 1.0)
                if "iTime" in program:
                    program["iTime"].value = t
                if "iTimeDelta" in program:
                    program["iTimeDelta"].value = dt
                if "iFrame" in program:
                    program["iFrame"].value = int(i)
                if "iFrameRate" in program:
                    program["iFrameRate"].value = float(safe_fps)
                if "iMouse" in program:
                    program["iMouse"].value = (0.0, 0.0, 0.0, 0.0)

                self._update_channel_textures(channels, i, wrap_mode=texture_wrap, filter_mode=texture_filter)

                self._set_custom_uniforms(program, custom_uniforms)

                self.ctx.clear(0.0, 0.0, 0.0, 1.0)
                vao.render(moderngl.TRIANGLE_STRIP)

                data = self.fbo.read(components=4, alignment=1)
                img_np = np.frombuffer(data, dtype=np.uint8).reshape((height, width, 4))
                
                img_flipped = np.flipud(img_np)[:, :, :3].copy()
                frames_tensor[i] = torch.from_numpy(img_flipped) / 255.0

        except Exception as e:
            print(f"[CreativeCode] Render Error at frame {i}: {e}")
            raise e
        finally:
            for tex in self.channel_textures:
                if tex is not None:
                    try:
                        tex.release()
                    except:
                        pass
            self.channel_textures = [None] * 4
            
            try:
                vao.release()
            except:
                pass
        
        return frames_tensor


_gpu_renderer = None


def get_gpu_renderer():
    global _gpu_renderer
    if _gpu_renderer is None:
        if not _HAS_MODERNGL:
            return None
        _gpu_renderer = CreativeCodeGPU()
    return _gpu_renderer





class CreativeCodeSettings:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "select_shader": (get_available_shaders(), {"default": "None"}),
                "shader_code": ("STRING", {"default": DEFAULT_SHADER, "multiline": True}),
                "width": ("INT", {"default": 640, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 360, "min": 64, "max": 4096, "step": 8}),
                "frames": ("INT", {"default": 1, "min": 1, "max": 2400, "step": 1}),
                "fps": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0, "step": 1.0}),
                "time_start": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 9999.0, "step": 0.1}),
            },
            "optional": {
                "version_mode": (["auto", "es300", "glsl330"], {"default": "auto"}),
                "code_type": (["glsl", "p5"], {"default": "glsl"}),
            }
        }

    RETURN_TYPES = ("CC_SETTINGS",)
    RETURN_NAMES = ("settings",)
    FUNCTION = "pack"
    CATEGORY = "CreativeCode"

    def pack(self, **kwargs):
        selected_shader = kwargs.get("select_shader")
        if selected_shader and selected_shader != "None":
            try:
                path = os.path.join(SHADERS_DIR, selected_shader)
                if os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        kwargs["shader_code"] = f.read()
                        print(f"[CreativeCode] Loaded shader preset: {selected_shader}")
            except Exception as e:
                print(f"[CreativeCode] Failed to load shader preset {selected_shader}: {e}")
                
        return (kwargs,)


class CreativeCodeChannels:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "iChannel0": ("IMAGE",),
                "iChannel1": ("IMAGE",),
                "iChannel2": ("IMAGE",),
                "iChannel3": ("IMAGE",),
                "texture_wrap": (["repeat", "clamp", "mirror"], {"default": "repeat"}),
                "texture_filter": (["linear", "nearest"], {"default": "linear"}),
            }
        }

    RETURN_TYPES = ("CC_CHANNELS",)
    RETURN_NAMES = ("channels",)
    FUNCTION = "pack"
    CATEGORY = "CreativeCode"

    def pack(self, **kwargs):
        return (kwargs,)


class CreativeCodeRender:
    RETURN_TYPES = ("IMAGE", "STRING",)
    RETURN_NAMES = ("images", "shader_code",)
    FUNCTION = "render"
    CATEGORY = "CreativeCode"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "shader_code": ("STRING", {"default": DEFAULT_SHADER, "multiline": True}),
                "width": ("INT", {"default": 640, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 360, "min": 64, "max": 4096, "step": 8}),
                "frames": ("INT", {"default": 1, "min": 1, "max": 2400, "step": 1}),
                "fps": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0, "step": 1.0}),
                "time_start": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 9999.0, "step": 0.1}),
            },
            "optional": {
                "settings": ("CC_SETTINGS",),
                "channels": ("CC_CHANNELS",),

                "custom_uniforms": ("STRING", {"default": "{}", "multiline": True}),
                "version_mode": (["auto", "es300", "glsl330"], {"default": "auto"}),
                "code_type": (["glsl", "p5"], {"default": "glsl"}),
            }
        }

    def render(self, shader_code, width, height, frames, fps, time_start,
               custom_uniforms="{}", version_mode="auto", code_type="glsl",
               settings=None, channels=None):

        texture_wrap = "repeat"
        texture_filter = "linear"
        iChannel0 = None
        iChannel1 = None
        iChannel2 = None
        iChannel3 = None

        # Override with packed settings if present
        if settings:
            shader_code = settings.get("shader_code", shader_code)
            width = settings.get("width", width)
            height = settings.get("height", height)
            frames = settings.get("frames", frames)
            fps = settings.get("fps", fps)
            time_start = settings.get("time_start", time_start)
            version_mode = settings.get("version_mode", version_mode)
            code_type = settings.get("code_type", code_type)
            
        # Unpack channels if present
        if channels:
            iChannel0 = channels.get("iChannel0")
            iChannel1 = channels.get("iChannel1")
            iChannel2 = channels.get("iChannel2")
            iChannel3 = channels.get("iChannel3")
            texture_wrap = channels.get("texture_wrap", texture_wrap)
            texture_filter = channels.get("texture_filter", texture_filter)
        
        MAX_RESOLUTION = 3840
        MIN_RESOLUTION = 1
        MAX_FRAMES = 10000

        # Ensure minimum resolution to prevent zero-size framebuffer errors
        if width < MIN_RESOLUTION or height < MIN_RESOLUTION:
            raise ValueError(f"[CreativeCode] Resolution must be at least {MIN_RESOLUTION}x{MIN_RESOLUTION}")

        if width > MAX_RESOLUTION or height > MAX_RESOLUTION:
            print(f"[CreativeCode] Resolution {width}x{height} exceeds cap!")
            raise ValueError(f"[CreativeCode] Resolution exceeds safety limits ({MAX_RESOLUTION}x{MAX_RESOLUTION})")
        
        frame_count = max(int(frames), 1)
        if frame_count > MAX_FRAMES:
             raise ValueError(f"[CreativeCode] Frame count exceeds safety limits ({MAX_FRAMES})")
             
        total_pixels = width * height * frame_count
        MAX_TOTAL_PIXELS = 1920 * 1080 * 100  # ~100 HD frames (~1.5GB RAM)
        
        if total_pixels > MAX_TOTAL_PIXELS:
            raise ValueError(f"[CreativeCode] Total render size too large! Requesting ~{total_pixels/1000000:.1f} Mpx")

        if not _HAS_MODERNGL:
            raise RuntimeError(
                "[CreativeCode] ModernGL is not installed or failed to load. "
                "GLSL shaders require ModernGL for GPU rendering. "
                "Install it with: pip install moderngl"
            )

        try:
            renderer = get_gpu_renderer()
            uniform_payload = {}
            if custom_uniforms:
                try:
                    uniform_payload = json.loads(custom_uniforms)
                except json.JSONDecodeError as e:
                    error_msg = f"Invalid custom_uniforms JSON: {e}"
                    print(f"[CreativeCode] {error_msg}")
                    raise ValueError(f"[CreativeCode] {error_msg}")
                except Exception as e:
                    error_msg = f"Error processing custom_uniforms: {e}"
                    print(f"[CreativeCode] {error_msg}")
                    raise ValueError(f"[CreativeCode] {error_msg}")

            detected_type = renderer._detect_code_type(shader_code)
            if detected_type == "p5" or code_type == "p5":
                # Look for cache ID injected by frontend
                cache_id = uniform_payload.get("_p5_uid")
                
                if cache_id:
                # Construct path: .../ComfyUI_CreativeCode/p5_cache/{cache_id}
                    try:
                        from PIL import Image, ImageOps
                        base_dir = os.path.dirname(os.path.abspath(__file__))
                        cache_dir = os.path.join(base_dir, "p5_cache", str(cache_id))
                        
                        if os.path.exists(cache_dir):
                            print(f"[CreativeCode] Loading P5 cache from: {cache_dir}")
                            # Filter for valid image files
                            files = sorted([f for f in os.listdir(cache_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))])
                            
                            if files:
                                images = []
                                for f in files:
                                    img_path = os.path.join(cache_dir, f)
                                    try:
                                        i = Image.open(img_path)
                                        i = ImageOps.exif_transpose(i)
                                        if i.mode == 'I':
                                            i = i.point(lambda i: i * (1 / 255))
                                        image = i.convert("RGB")
                                        img_np = np.array(image).astype(np.float32) / 255.0
                                        images.append(torch.from_numpy(img_np))
                                    except Exception as img_err:
                                        print(f"[CreativeCode] Failed to load frame {f}: {img_err}")
                                
                                if images:
                                    # Validate cached frame sizes
                                    first_frame = images[0]
                                    cache_height, cache_width = first_frame.shape[:2]
                                    total_pixels = cache_width * cache_height * len(images)
                                    MAX_TOTAL_PIXELS = 1920 * 1080 * 100

                                    if total_pixels > MAX_TOTAL_PIXELS:
                                        raise ValueError(
                                            f"[CreativeCode] P5 cache frames too large! "
                                            f"Cache: {cache_width}x{cache_height}x{len(images)} = ~{total_pixels/1000000:.1f} Mpx "
                                            f"(limit: ~{MAX_TOTAL_PIXELS/1000000:.1f} Mpx)"
                                        )

                                    # Handle frame count matching
                                    req_frames = int(frames)
                                    loaded_count = len(images)

                                    if loaded_count < req_frames:
                                        print(f"[CreativeCode] Warning: Cached frames ({loaded_count}) < Requested frames ({req_frames}). Looping to fill.")
                                        # Loop to fill efficiently
                                        current_len = len(images)
                                        needed = req_frames - current_len
                                        # Repeat list enough times to cover needed, then slice
                                        repeat_count = (needed // current_len) + 1
                                        images.extend((images * repeat_count)[:needed])
                                    elif loaded_count > req_frames:
                                        # Truncate
                                        images = images[:req_frames]
                                        
                                    output_images = torch.stack(images)
                                    return (output_images, shader_code,)
                            else:
                                print("[CreativeCode] Cache directory is empty.")
                        else:
                             print(f"[CreativeCode] Cache directory not found: {cache_dir}")
                    except Exception as e:
                        print(f"[CreativeCode] Cache load error: {e}")

                # If we get here, no valid cache was found
                raise ValueError(
                    "[CreativeCode] P5.js Render Error:\n"
                    "Cannot render P5.js directly on backend.\n"
                    "Please use the 'BAKE ANIMATION' button in the node UI before queuing.\n"
                    "(This captures frames from your browser and sends them to the node)"
                )

            output = renderer.render(
                shader_code,
                int(width),
                int(height),
                frame_count,
                float(fps),
                float(time_start),
                version_mode=version_mode,
                custom_uniforms=uniform_payload,
                channels=[iChannel0, iChannel1, iChannel2, iChannel3],
                texture_wrap=texture_wrap,
                texture_filter=texture_filter,
            )
            return (output, shader_code,)
        except moderngl.Error as gl_error:
            error_msg = str(gl_error)
            if "compile" in error_msg.lower() or "shader" in error_msg.lower():
                raise ValueError(
                    f"[CreativeCode] Shader compilation failed:\n{error_msg}\n"
                    "Note: Preview uses WebGL2 (#version 300 es), but backend uses ModernGL (#version 330). "
                    "Some syntax differences may cause this error."
                )
            raise ValueError(f"[CreativeCode] OpenGL Error: {error_msg}")
        except Exception as e:
            import traceback
            print(f"[CreativeCode] Unexpected render error:\n{traceback.format_exc()}")
            raise RuntimeError(f"[CreativeCode] Render failed: {e}")


NODE_CLASS_MAPPINGS = {
    "CreativeCodeRender": CreativeCodeRender,
    "CreativeCodeSettings": CreativeCodeSettings,
    "CreativeCodeChannels": CreativeCodeChannels,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CreativeCodeRender": "CreativeCode Code2Vid",
    "CreativeCodeSettings": "CreativeCode Settings",
    "CreativeCodeChannels": "CreativeCode Channels",
}
