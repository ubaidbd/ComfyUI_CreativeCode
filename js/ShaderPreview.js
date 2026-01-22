const LOOP_SECONDS = 10.0;

const AUTO_ALIAS_DEFINITIONS = [
    {
        name: "t",
        directive: "#define t iTime",
        description: "Added `#define t iTime` so short-form time expressions compile.",
    },
];

export class ShaderPreview {
    constructor(canvas, errorEl, onError) {
        this.canvas = canvas;
        this.errorEl = errorEl;
        this.onError = onError;
        this.gl = null;
        this.program = null;
        this.vertexBuffer = null;
        this.lastFrameTime = 0;
        this.startTime = performance.now();
        this.running = false;


        this._frameCount = 0;
        this._lastFpsTime = 0;
        this._fps = 0;

        this._isWebGL2 = false;
        this._uniformDefinitions = [];
        this._uniformMeta = new Map();
        this._uniformLocations = new Map();
        this._uniformValues = {};
        this._statsEl = null;
        this._warningEl = null;
        this._versionEl = null;
        this._versionMode = "auto";
        this._lastCompileTime = null;
        this._lastRenderTime = null;
        this._lastError = "";
        this._lastWarnings = "";
        this._versionNote = "";

        this._channelTextures = [null, null, null, null];
        this._channelImages = [null, null, null, null];
        this._channelUrls = [null, null, null, null];
        this._autoWarnings = [];
        this._injectedUniformLines = 0;
        this._lastSource = null;
        this._contextLossHandlerAdded = false;

        this._textureWrap = "repeat";
        this._textureFilter = "linear";
        this._fpsLimit = 30;
    }

    _initGL() {
        if (this.gl) return true;
        const gl2 = this.canvas.getContext("webgl2");
        if (gl2) {
            this.gl = gl2;
            this._isWebGL2 = true;
        } else {
            this.gl = this.canvas.getContext("webgl");
            this._isWebGL2 = false;
        }

        if (!this._contextLossHandlerAdded) {
            this.canvas.addEventListener("webglcontextlost", (e) => {
                e.preventDefault();
                console.warn("[ShaderPreview] WebGL context lost");
                this.program = null;
                this._emptyTexture = null;
                this._channelTextures = [null, null, null, null];
            });

            this.canvas.addEventListener("webglcontextrestored", () => {
                console.info("[ShaderPreview] WebGL context restored, recompiling shader");
                this.gl = null;
                this._initGL();
                if (this._lastSource) {
                    this.setSource(this._lastSource);
                }
            });
            this._contextLossHandlerAdded = true;
        }

        return !!this.gl;
    }

    _compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(info || "Shader compilation failed.");
        }
        return shader;
    }

    _shouldUseOutColor() {
        return this._isWebGL2 && (this._versionMode === "es300" || this._versionMode === "auto" || this._versionMode === "glsl330");
    }

    _getVersionHeader(useOutColor) {
        const headerLines = [];
        if (this._versionMode === "glsl330") {
            headerLines.push("#version 300 es");
        } else if (this._versionMode === "es300") {
            headerLines.push("#version 300 es");
        } else if (this._versionMode === "auto" && this._isWebGL2) {
            headerLines.push("#version 300 es");
        }
        headerLines.push("precision highp float;");
        headerLines.push("uniform vec3 iResolution;");
        headerLines.push("uniform float iTime;");
        headerLines.push("uniform float iTimeDelta;");
        headerLines.push("uniform int iFrame;");
        headerLines.push("uniform float iFrameRate;");
        headerLines.push("uniform vec4 iMouse;");

        headerLines.push("uniform sampler2D iChannel0;");
        headerLines.push("uniform sampler2D iChannel1;");
        headerLines.push("uniform sampler2D iChannel2;");
        headerLines.push("uniform sampler2D iChannel3;");
        if (useOutColor) {
            headerLines.push("out vec4 outColor;");
        }
        return headerLines.join("\n") + "\n";
    }

    _injectCustomUniforms(source) {
        if (!this._uniformDefinitions || !this._uniformDefinitions.length) {
            this._injectedUniformLines = 0;
            return source;
        }

        let declarations = "";
        let lineCount = 0;
        this._uniformDefinitions.forEach(u => {
            // Check if user already manually declared it (simple check)
            const pattern = new RegExp(`\\buniform\\s+${u.type}\\s+${u.name}\\b`);
            if (!pattern.test(source)) {
                declarations += `uniform ${u.type} ${u.name};\n`;
                lineCount++;
            }
        });

        this._injectedUniformLines = lineCount;
        return declarations + source;
    }

    _buildFragmentSource(userCode) {
        // Replace @ and #version lines with empty space to keep line numbers aligned
        const cleaned = userCode
            .split("\n")
            .map(line => {
                const trimmed = line.trim();
                if (trimmed.startsWith("#version")) return "";
                if (line.includes("@")) return "";
                return line;
            })
            .join("\n")
            .replace(/precision\s+\w+\s+float\s*;/g, "")
            .replace(/texture2D/g, "texture")
            .replace(/uniform\s+(float|int|bool|vec2|vec3|vec4)\s+([A-Za-z_]\w*)\s*=\s*[^;]+;/gi, 'uniform $1 $2;');

        const { patchedSource, warnings: aliasWarnings } = this._applyAutoAliases(cleaned);
        this._autoWarnings = aliasWarnings;

        const useOutColor = this._shouldUseOutColor();
        const header = this._getVersionHeader(useOutColor);
        const outputVar = useOutColor ? "outColor" : "gl_FragColor";

        const injectedSource = this._injectCustomUniforms(patchedSource);

        return `${header}${injectedSource}
void main() {
    vec4 color = vec4(0.0);
    mainImage(color, gl_FragCoord.xy);
    ${outputVar} = color;
}`;
    }

    _buildVertexSource() {
        const useOutColor = this._shouldUseOutColor();
        if (useOutColor) {
            return `#version 300 es
in vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
        }
        return `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
    }

    setStatsElements({ statsEl, warningEl, versionEl }) {
        this._statsEl = statsEl;
        this._warningEl = warningEl;
        this._versionEl = versionEl;
        this._updateStats();
        this._updateVersionNote();
    }

    setFPS(fps) {
        this._fpsLimit = Math.max(1, parseFloat(fps) || 30);
    }

    setVersionMode(mode) {
        this._versionMode = mode;
        this._versionNote = this._describeVersion();
        this._updateVersionNote();
    }

    _describeVersion() {
        return "";
    }

    setUniformDefinitions(defs) {
        this._uniformDefinitions = defs;
        this._uniformMeta.clear();
        defs.forEach(def => this._uniformMeta.set(def.name, def));
        this._cacheUniformLocations();
    }

    updateUniformValues(values) {
        this._uniformValues = { ...values };
    }

    setSource(userCode) {
        this._lastSource = userCode;

        if (!this._initGL()) {
            this._setError("WebGL not available.");
            return;
        }

        const gl = this.gl;
        if (this.program) {
            gl.deleteProgram(this.program);
            this.program = null;
        }

        try {
            const vertexSource = this._buildVertexSource();
            const fragmentSource = this._buildFragmentSource(userCode);
            const compileStart = performance.now();
            const vs = this._compileShader(gl.VERTEX_SHADER, vertexSource);
            const fs = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);

            const program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                const info = gl.getProgramInfoLog(program);
                gl.deleteProgram(program);
                throw new Error(info || "Shader linking failed.");
            }

            this.program = program;
            this._lastCompileTime = performance.now() - compileStart;
            this._lastWarnings = (gl.getProgramInfoLog(program) || "").trim();
            this._lastError = "";
            this._setError("");
            this._initGeometry();
            this._cacheUniformLocations();
            this._updateStats();
        } catch (err) {
            this._lastError = err.message || String(err);
            this._lastWarnings = "";
            this._updateStats();
            this._setError(err.message || String(err));
        }
    }

    _initGeometry() {
        const gl = this.gl;
        if (this.vertexBuffer) return;
        const vertices = new Float32Array([
            -1.0, -1.0,
            1.0, -1.0,
            -1.0, 1.0,
            1.0, 1.0,
        ]);
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    _setError(message) {
        if (!message) {
            this.errorEl.textContent = "";
            this.errorEl.style.display = "none";
            this._lastError = "";
            this._updateStats();
            if (this.onError) this.onError([]);
            return;
        }

        if (this.onError) {
            const headerLineCount = this._getHeaderLineCount();
            const lines = message.split('\n');
            const errors = [];
            lines.forEach(line => {
                const match = line.match(/ERROR:\s*\d+:(\d+)\s*:(.*)/i) ||
                    line.match(/0:(\d+):\s*(.*)/) ||
                    line.match(/line\s+(\d+)\s*:(.*)/i) ||
                    line.match(/:(?:\d+:)?(\d+):(.*)/);

                if (match) {
                    const reportedLine = parseInt(match[1], 10);
                    const msg = match[2];
                    if (!isNaN(reportedLine)) {
                        const userLine = Math.max(1, reportedLine - headerLineCount);
                        if (!errors.some(e => e.line === userLine && e.message === msg.trim())) {
                            errors.push({ line: userLine, message: (msg || "").trim() });
                        }
                    }
                }
            });
            this.onError(errors);
        }

        const formattedMessage = this._formatShaderError(message);
        this.errorEl.textContent = `Compile Error\n${formattedMessage}`;
        this.errorEl.style.display = "block";
        this._lastError = message;
        this._updateStats();
    }

    _formatShaderError(message) {
        const headerLineCount = this._getHeaderLineCount();
        const lines = message.split('\n');
        const formatted = lines.map(line => {
            const match = line.match(/ERROR:\s*\d+:(\d+)\s*:/);
            if (match) {
                const reportedLine = parseInt(match[1], 10);
                const userLine = Math.max(1, reportedLine - headerLineCount);
                return line.replace(/ERROR:\s*\d+:\d+\s*:/, `Line ${userLine}:`);
            }
            return line;
        });
        return formatted.join('\n');
    }

    _getHeaderLineCount() {
        const useOutColor = this._shouldUseOutColor();
        const header = this._getVersionHeader(useOutColor);
        const autoAliasLines = this._autoWarnings.length;
        const uniformInjectionLines = this._injectedUniformLines;
        return header.split('\n').length - 1 + autoAliasLines + uniformInjectionLines;
    }

    _cacheUniformLocations() {
        if (!this.gl || !this.program) return;
        this._uniformLocations.clear();
        this._uniformMeta.forEach((def, name) => {
            const location = this.gl.getUniformLocation(this.program, name);
            if (location !== null) {
                this._uniformLocations.set(name, { location, type: def.type });
            }
        });
    }

    _applyUniformValues() {
        if (!this.gl || !this.program) return;
        this._uniformLocations.forEach(({ location, type }, name) => {
            const value = this._uniformValues[name];
            if (value === undefined) return;
            if (type === "float" || type === "int" || type === "bool") {
                this._setScalarUniform(location, type, value);
            } else {
                this._setVectorUniform(location, type, value);
            }
        });
    }

    _setScalarUniform(location, type, value) {
        const gl = this.gl;
        const numeric = typeof value === "boolean" ? (value ? 1 : 0) : parseFloat(value);
        if (!Number.isFinite(numeric)) return;
        if (type === "int" || type === "bool") {
            gl.uniform1i(location, Math.round(numeric));
        } else {
            gl.uniform1f(location, numeric);
        }
    }

    _setVectorUniform(location, type, value) {
        const gl = this.gl;
        const data = Array.isArray(value) ? value : [value];
        const sanitized = data.map(v => Number.isFinite(v) ? v : 0);
        if (type === "vec2") gl.uniform2fv(location, sanitized.slice(0, 2));
        if (type === "vec3") gl.uniform3fv(location, sanitized.slice(0, 3));
        if (type === "vec4") gl.uniform4fv(location, sanitized.slice(0, 4));
    }

    _updateStats() {
        if (this._statsEl) {
            this._statsEl.textContent = `FPS: ${Math.round(this._fps)}`;
        }
        if (this._warningEl) {
            if (this._lastWarnings) {
                const combined = [this._lastWarnings, ...this._autoWarnings].filter(Boolean);
                this._warningEl.textContent = `Warnings: ${combined.join(" | ")}`;
            } else if (this._autoWarnings.length) {
                this._warningEl.textContent = `Warnings: ${this._autoWarnings.join(" | ")}`;
            } else {
                this._warningEl.textContent = "";
            }
        }
    }

    _usesIdentifier(code, name) {
        const pattern = new RegExp(`\\b${name}\\b`);
        return pattern.test(code);
    }

    _hasDeclaration(code, name) {
        const pattern = new RegExp(`\\b(?:uniform\\s+)?(?:float|int|vec\\d|bool)\\s+${name}\\b`);
        return pattern.test(code);
    }

    _hasDirective(code, name) {
        const pattern = new RegExp(`#define\\s+${name}\\b`);
        return pattern.test(code);
    }

    _applyAutoAliases(code) {
        const injections = [];
        const warnings = [];
        AUTO_ALIAS_DEFINITIONS.forEach(def => {
            if (!this._usesIdentifier(code, def.name)) return;
            if (this._hasDeclaration(code, def.name)) return;
            if (this._hasDirective(code, def.name)) return;
            injections.push(def.directive);
            warnings.push(def.description);
        });
        if (injections.length) {
            return { patchedSource: `${injections.join("\n")}\n${code}`, warnings };
        }
        return { patchedSource: code, warnings };
    }

    _updateVersionNote() {
        if (this._versionEl) {
            const note = this._versionNote || this._describeVersion();
            this._versionEl.textContent = note;
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.startTime = performance.now();
        this.lastFrameTime = 0;
        this._tick();
    }

    stop() {
        this.running = false;
    }

    _tick() {
        if (!this.running) return;
        requestAnimationFrame((now) => {
            const elapsed = (now - this.startTime) / 1000;
            const frameDuration = 1 / this._fpsLimit;
            if (now - this.lastFrameTime >= frameDuration * 1000) {
                this.lastFrameTime = now;
                this._render(elapsed % LOOP_SECONDS);
                this._frameCount++;
                if (now - this._lastFpsTime >= 1000) {
                    this._fps = this._frameCount;
                    this._frameCount = 0;
                    this._lastFpsTime = now;
                    this._updateStats();
                }
            }
            this._tick();
        });
    }

    _render(time) {
        if (!this.program) return;
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        const posLoc = gl.getAttribLocation(this.program, "aPosition");
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const iResolution = gl.getUniformLocation(this.program, "iResolution");
        const iTime = gl.getUniformLocation(this.program, "iTime");
        const iTimeDelta = gl.getUniformLocation(this.program, "iTimeDelta");
        const iFrame = gl.getUniformLocation(this.program, "iFrame");
        const iFrameRate = gl.getUniformLocation(this.program, "iFrameRate");
        const iMouse = gl.getUniformLocation(this.program, "iMouse");

        if (iResolution) gl.uniform3f(iResolution, this.canvas.width, this.canvas.height, 1.0);
        if (iTime) gl.uniform1f(iTime, time);
        if (iTimeDelta) gl.uniform1f(iTimeDelta, 1 / this._fpsLimit);
        if (iFrame) gl.uniform1i(iFrame, Math.floor(time * this._fpsLimit));
        if (iFrameRate) gl.uniform1f(iFrameRate, this._fpsLimit);
        if (iMouse) gl.uniform4f(iMouse, 0, 0, 0, 0);

        this._bindChannelTextures();

        this._applyUniformValues();

        const renderStart = performance.now();
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this._lastRenderTime = performance.now() - renderStart;
        this._updateStats();
    }

    _bindChannelTextures() {
        const gl = this.gl;
        if (!gl || !this.program) return;

        for (let i = 0; i < 4; i++) {
            const loc = gl.getUniformLocation(this.program, `iChannel${i}`);
            if (loc) {
                gl.activeTexture(gl.TEXTURE0 + i);
                if (this._channelTextures[i]) {
                    gl.bindTexture(gl.TEXTURE_2D, this._channelTextures[i]);
                } else {
                    if (!this._emptyTexture) {
                        this._emptyTexture = gl.createTexture();
                        gl.bindTexture(gl.TEXTURE_2D, this._emptyTexture);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
                    }
                    gl.bindTexture(gl.TEXTURE_2D, this._emptyTexture);
                }
                gl.uniform1i(loc, i);
            }
        }
    }

    setTextureOptions(wrap, filter) {
        this._textureWrap = wrap || "repeat";
        this._textureFilter = filter || "linear";

        if (this.gl) {
            this._channelTextures.forEach(tex => {
                if (tex) {
                    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
                    this._applyTextureParams(this.gl.TEXTURE_2D);
                }
            });
        }
    }

    _applyTextureParams(target) {
        const gl = this.gl;
        let wrapMode = gl.REPEAT;
        if (this._textureWrap === "clamp") wrapMode = gl.CLAMP_TO_EDGE;
        else if (this._textureWrap === "mirror") wrapMode = gl.MIRRORED_REPEAT;

        let filterMode = this._textureFilter === "nearest" ? gl.NEAREST : gl.LINEAR;

        gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapMode);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapMode);
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, filterMode);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, filterMode);
    }

    setChannelImage(channel, imageUrl) {
        if (channel < 0 || channel > 3) return;
        if (this._channelUrls[channel] === imageUrl) return;
        this._channelUrls[channel] = imageUrl;

        if (!this._initGL()) return;

        const gl = this.gl;
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            if (this._channelTextures[channel]) {
                gl.deleteTexture(this._channelTextures[channel]);
            }

            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);


            this._applyTextureParams(gl.TEXTURE_2D);


            if (this._isPowerOfTwo(img.width) && this._isPowerOfTwo(img.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            }

            this._channelTextures[channel] = tex;
            this._channelImages[channel] = img;

        };

        img.onerror = () => {
            console.error(`[ShaderPreview] Failed to load iChannel${channel}: ${imageUrl}`);
        };

        img.src = imageUrl;
    }

    clearChannelImage(channel) {
        if (channel < 0 || channel > 3) return;

        this._channelUrls[channel] = null;

        if (!this.gl) return;

        if (this._channelTextures[channel]) {
            this.gl.deleteTexture(this._channelTextures[channel]);
            this._channelTextures[channel] = null;
            this._channelImages[channel] = null;
        }
    }

    _isPowerOfTwo(value) {
        return (value & (value - 1)) === 0;
    }
}
