from aiohttp import web
import asyncio
from pathlib import Path
import json
import aiohttp
import logging
import re

logger = logging.getLogger("creativecode")

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_TIMEOUT = aiohttp.ClientTimeout(total=15, connect=5)  # 15s total, 5s connect
OLLAMA_GENERATE_TIMEOUT = aiohttp.ClientTimeout(total=120, connect=5)  # 120s for generation


EXT_DIR = Path(__file__).parent
SHADER_LIBRARY_DIR = EXT_DIR / "saved_shaders"
SHADER_LIBRARY_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".glsl", ".frag", ".txt", ".js"}


def _sanitize_filename(name: str) -> str:
    """Sanitize filename to prevent path traversal and invalid characters."""
    if not name or not isinstance(name, str):
        return "shader"

    name = Path(name).name
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name)
    safe = re.sub(r'_+', '_', safe).strip("_")

    reserved_names = {"con", "prn", "aux", "nul", "com1", "com2", "com3", "com4",
                      "lpt1", "lpt2", "lpt3", "lpt4", "clock$"}
    if not safe or safe.lower() in reserved_names:
        safe = "shader"

    return safe[:64]


def _is_safe_path(path: Path, base_dir: Path) -> bool:
    """Check if resolved path is within base directory."""
    try:
        resolved = path.resolve()
        base_resolved = base_dir.resolve()
        resolved.relative_to(base_resolved)
        return True
    except ValueError:
        return False


def _list_shaders():
    shaders = []
    # Recursively search for allowed files in subdirectories
    for path in SHADER_LIBRARY_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            uses_channels = False
            has_uniforms = False
            try:
                content = path.read_text(encoding="utf-8")
                code_only = re.sub(r'//.*', '', content)
                code_only = re.sub(r'/\*.*?\*/', '', code_only, flags=re.DOTALL)
                uses_channels = bool(re.search(r'\biChannel[0-9]\b', code_only))
                has_uniforms = bool(re.search(r'\buniform\s+(float|int|bool|vec2|vec3|vec4)\b', code_only, re.IGNORECASE))
                
                if not has_uniforms:
                    has_uniforms = bool(re.search(r'@uniform\s+(float|int|bool|vec2|vec3|vec4)\b', content, re.IGNORECASE))
            except Exception:
                pass
                
            shaders.append({
                "name": path.stem,
                "filename": path.name,
                "modified": path.stat().st_mtime,
                "category": path.parent.name if path.parent != SHADER_LIBRARY_DIR else "uncategorized",
                "uses_channels": uses_channels,
                "has_uniforms": has_uniforms
            })
    return shaders


def setup_routes():
    try:
        import server
        routes = server.PromptServer.instance.routes
    except Exception as e:
        print(f"[CreativeCode] Could not register routes: {e}")
        return

    @routes.get("/creativecode/shaders")
    async def list_shaders(request):
        try:
            return web.json_response({"shaders": _list_shaders()})
        except Exception as e:
            logger.error(f"list_shaders error: {e}", exc_info=True)
            return web.json_response({"error": "Failed to list shaders"}, status=500)

    @routes.get("/creativecode/shaders/{name}")
    async def get_shader(request):
        name = request.match_info["name"]

        target = None
        for sub in ["", "glsl", "p5"]:
            for ext in ALLOWED_EXTENSIONS:
                candidate = SHADER_LIBRARY_DIR / sub / f"{name}{ext}"
                if candidate.is_file() and _is_safe_path(candidate, SHADER_LIBRARY_DIR):
                    target = candidate
                    break
            if target: break

        if not target:
            return web.json_response({"error": "Shader not found"}, status=404)

        try:
            return web.json_response({
                "name": name,
                "code": target.read_text(encoding="utf-8"),
                "filename": target.name,
                "modified": target.stat().st_mtime,
            })
        except Exception as e:
            logger.error(f"get_shader error for '{name}': {e}", exc_info=True)
            return web.json_response({"error": "Failed to read shader"}, status=500)

    @routes.post("/creativecode/upload_canvas_frame")
    async def upload_canvas_frame(request):
        try:
            reader = await request.multipart()
            
            cache_id = None
            filename = None
            file_data = None
            
            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == 'cache_id':
                    cache_id = await part.text()
                elif part.name == 'image':
                    filename = part.filename
                    file_data = await part.read()
            
            if not cache_id or not file_data:
                return web.json_response({"error": "Missing cache_id or image data"}, status=400)
            
            safe_cache_id = re.sub(r'[^a-zA-Z0-9_\-]', '', cache_id)
            if not safe_cache_id or len(safe_cache_id) < 3:
                return web.json_response({"error": "Invalid cache_id"}, status=400)
            
            if filename:
                safe_filename = Path(filename).name
                if not re.match(r'^frame_\d{5}\.(png|jpg|jpeg)$', safe_filename, re.IGNORECASE):
                    safe_filename = f"frame_{len(list((EXT_DIR / 'p5_cache' / safe_cache_id).glob('*'))):05d}.png"
            else:
                safe_filename = "frame_00000.png"
            
            # Save to p5_cache directory inside the extension folder
            save_dir = EXT_DIR / "p5_cache" / safe_cache_id
            save_dir.mkdir(parents=True, exist_ok=True)
            
            # Verify path is within expected directory
            file_path = save_dir / safe_filename
            if not _is_safe_path(file_path, EXT_DIR / "p5_cache"):
                return web.json_response({"error": "Invalid path"}, status=400)
            
            file_path.write_bytes(file_data)
            
            return web.json_response({"status": "ok", "path": str(file_path)})

        except Exception as e:
            logger.error(f"Upload error: {e}", exc_info=True)
            return web.json_response({"error": str(e)}, status=500)

    @routes.post("/creativecode/shaders")
    async def save_shader(request):
        try:
            payload = await request.json()
            name = payload.get("name", "").strip()
            code = payload.get("code", "")
            if not name or not code:
                return web.json_response({"error": "Name and code are required"}, status=400)

            safe = _sanitize_filename(name)
            
            # Subdirectory detection
            subdir = "glsl"
            if safe.startswith("p5_") or "p5" in safe.lower():
                subdir = "p5"
            
            target_dir = SHADER_LIBRARY_DIR / subdir
            target_dir.mkdir(exist_ok=True)

            # Use appropriate extension based on code type
            ext = ".js" if subdir == "p5" else ".glsl"
            target = target_dir / f"{safe}{ext}"
            target.write_text(code, encoding="utf-8")

            return web.json_response({"status": "ok", "filename": target.name})
        except Exception as e:
            logger.error(f"save_shader error: {e}", exc_info=True)
            return web.json_response({"error": "Failed to save shader"}, status=500)

    @routes.get("/creativecode/ollama/models")
    async def list_ollama_models(request):
        try:
            async with aiohttp.ClientSession(timeout=OLLAMA_TIMEOUT) as session:
                async with session.get(f"{OLLAMA_BASE_URL}/api/tags") as resp:
                    if resp.status != 200:
                        return web.json_response({"error": "Failed to connect to Ollama"}, status=502)
                    data = await resp.json()
                    return web.json_response(data)
        except Exception as e:
            return web.json_response({"error": f"Ollama connection failed: {e}"}, status=502)

    @routes.post("/creativecode/ollama/generate")
    async def generate_shader(request):
        try:
            payload = await request.json()
            model = payload.get("model", "llama3")
            prompt = payload.get("prompt", "")
            mode = payload.get("mode", "create") # create or fix
            current_code = payload.get("code", "")
            
            # Detect if code is P5.js or GLSL based on content
            is_p5 = "function setup" in current_code or "createCanvas" in current_code
            
            system_prompt = (
                "You are an expert creative coder. "
                "Your task is to write COMPLETE, COMPILABLE code for a ShaderToy-style node. "
                "Output ONLY the code inside a code block.\n\n"
                "CRITICAL RULES:\n"
                "1. You MUST return the FULL source code. Do NOT return just the modified parts.\n"
                "2. Do NOT omit helper functions or struct definitions. If they are used, they MUST be defined.\n"
                "3. If you introduce new variables (like speeds, colors), DEFINE them (e.g., #define or const float).\n"
                "4. Do not assume variables exist unless you see them defined in the provided code.\n"
                "5. Standard uniforms available: iResolution, iTime, iMouse, iChannel0-3.\n"
            )
            
            if is_p5:
                system_prompt += (
                    "Write P5.js JavaScript. Include setup() and draw(). Use standard global mode.\n"
                    "IMPORTANT: If you use shaders/GLSL inside P5, you MUST use 'createCanvas(w, h, WEBGL)'.\n"
                    "Ensure uniforms are passed correctly via 'shader.setUniform()'.\n"
                )
            else:
                system_prompt += "Write GLSL ShaderToy code. Entry point is mainImage(out vec4 fragColor, in vec2 fragCoord).\n"

            system_prompt += "Do not add explanations outside the code block."
            
            if current_code and len(current_code.strip()) > 50 and mode != "create":
                user_prompt = (
                    f"Current Code:\n```\n{current_code}\n```\n\n"
                    f"User Request: {prompt}\n\n"
                    "Task: Update the code to fulfill the request. Maintain existing logic/visuals unless asked to change. "
                    "ENSURE ALL used variables are declared. RETURN THE ENTIRE FILE."
                )
            else:
                user_prompt = (
                    f"Current Code (Context):\n```\n{current_code}\n```\n\n" if current_code else ""
                ) + f"Create a visual effect: {prompt}\nWrite the full code."

            ollama_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False 
            }

            async with aiohttp.ClientSession(timeout=OLLAMA_GENERATE_TIMEOUT) as session:
                async with session.post(f"{OLLAMA_BASE_URL}/api/chat", json=ollama_payload) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        return web.json_response({"error": f"Ollama error: {text}"}, status=resp.status)
                    
                    data = await resp.json()
                    content = data.get("message", {}).get("content", "")
                    
                    print(f"[CreativeCode] AI Raw Response Length: {len(content)}")
                    # print(f"[CreativeCode] AI Raw Response Start: {content[:100]}...") # Optional: Debug start

                    # Cleanup: Extract code from markdown blocks if present
                    # Match ```glsl, ```c, ```cpp, ```javascript, ```js, or just ```
                    code_match = re.search(r"```(?:\w+)?\n(.*?)```", content, re.DOTALL)
                    if code_match:
                        extracted = code_match.group(1)
                        print(f"[CreativeCode] Extracted code length: {len(extracted)}")
                        content = extracted
                    else:
                        print("[CreativeCode] No code block found, assuming raw text is code.")

                    return web.json_response({"code": content.strip()})

        except json.JSONDecodeError:
            return web.json_response({"error": "Invalid JSON payload"}, status=400)
        except asyncio.TimeoutError:
            return web.json_response({"error": "Ollama request timed out. Try a shorter prompt or check if Ollama is running."}, status=504)
        except aiohttp.ClientError as e:
            logger.error(f"Ollama connection error: {e}", exc_info=True)
            return web.json_response({"error": "Failed to connect to Ollama"}, status=502)
        except Exception as e:
            logger.error(f"generate_shader error: {e}", exc_info=True)
            return web.json_response({"error": "Failed to generate shader"}, status=500)
             
    print("[CreativeCode] HTTP routes registered (Ollama enabled)")
