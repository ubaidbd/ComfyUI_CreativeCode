export class P5Preview {
    constructor(node, errorBox, width, height, wrapper, onError) {
        this.container = node;
        this.errorBox = errorBox;
        this.width = width || 320;
        this.height = height || 180;
        this.instance = null;
        this.wrapper = wrapper;
        this.processingCode = "";
        this._channels = [null, null, null, null];
        this._channelUrls = [null, null, null, null];
        this._fpsLimit = 24;
        this._statsEl = null;
        this._lastFrameTime = 0;
        this._frameCount = 0;
        this._fps = 0;
        this._lastRenderTime = 0;
        this.onError = onError;
        this.instanceId = `p5_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        if (this.container) this.container.style.display = "none";
    }

    setChannelImage(channel, imageUrl) {
        if (channel < 0 || channel > 3) return;
        if (this._channelUrls[channel] === imageUrl) return;
        this._channelUrls[channel] = imageUrl;
        this._channels[channel] = null;

        if (this.instance && typeof this.instance.loadImage === 'function') {
            this.instance.loadImage(imageUrl, (img) => {
                this._channels[channel] = img;
                this.instance[`iChannel${channel}`] = img;
            });
        }
    }

    clearChannelImage(channel) {
        if (channel < 0 || channel > 3) return;
        this._channelUrls[channel] = null;
        this._channels[channel] = null;
        if (this.instance) {
            this.instance[`iChannel${channel}`] = null;
        }
    }

    setFPS(fps) {
        this._fpsLimit = Math.max(1, parseFloat(fps) || 24);
        if (this.instance && typeof this.instance.frameRate === 'function') {
            this.instance.frameRate(this._fpsLimit);
        }
    }

    setStatsElements({ statsEl }) {
        this._statsEl = statsEl;
    }

    _updateStats() {
        if (this._statsEl) {
            this._statsEl.textContent = `FPS: ${Math.round(this._fps)}`;
        }
    }

    _reportError(err) {
        const message = err.message || String(err);
        const errors = [];
        const stack = err.stack || "";

        // P5 specific: try to get accurate line from eval
        const match = stack.match(/<anonymous>:(\d+):(\d+)/) ||
            stack.match(/eval:(\d+):(\d+)/) ||
            stack.match(/at\s+.\s+\(.*?(\d+):(\d+)\)/);

        if (match) {
            errors.push({ line: parseInt(match[1]), message: message });
        } else {
            errors.push({ line: 1, message: message });
        }

        if (this.onError) this.onError(errors);

        if (this.errorBox) {
            let displayMsg = `[P5 Error] ${message}`;
            if (match) displayMsg += ` (Line ${match[1]})`;
            this.errorBox.textContent = displayMsg;
            this.errorBox.style.display = "block";
        }
    }

    start() {
        this._frameCount = 0;
        this._fps = 0;
        this._lastRenderTime = 0;
        this._lastFrameTime = performance.now();
        this._reload();
    }

    stop() {
        if (this.instance) {
            try {
                this.instance.remove();
            } catch (e) { }
            this.instance = null;
        }
        if (window._p5Instances && this.instanceId) {
            delete window._p5Instances[this.instanceId];
        }
        if (this.container) {
            this.container.innerHTML = "";
        }
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        if (this.instance && this.instance.canvas) {
            try {
                if (typeof this.instance.resizeCanvas === 'function') {
                    this.instance.resizeCanvas(w, h);
                }

                this.instance.width = w;
                this.instance.height = h;

                this.instance.canvas.style.width = w + "px";
                this.instance.canvas.style.height = h + "px";
            } catch (e) {
                // Ignore
            }
        }
    }

    update(code) {
        if (this.processingCode === code) return;
        this.processingCode = code;
        this._reload();
    }

    setSource(code) {
        this.update(code);
    }

    async _reload() {
        this.stop();

        const containerRef = this.container;
        const wrapperRef = this.wrapper;
        const targetWidth = this.width;
        const targetHeight = this.height;
        let processedCode = this.processingCode;
        const self = this;

        if (!processedCode) return;

        // Detect Processing-style syntax to trigger transpilation
        const hasProcessingSyntax = /\bvoid\s+(setup|draw)\s*\(/.test(processedCode) ||
            /\b(int|float|boolean)\s+\w+/.test(processedCode) ||
            /\bnew\s+(float|int|boolean)\s*\[/.test(processedCode) ||
            /#/.test(processedCode);

        if (hasProcessingSyntax) {
            try {
                if (typeof window.transpileProcessingToJS === 'function') {
                    processedCode = window.transpileProcessingToJS(processedCode);
                }
            } catch (transpileErr) {
                console.error("Transpilation error:", transpileErr);
            }
        }

        if (!processedCode.includes("function setup") && !processedCode.includes("setup = function")) {
            processedCode += "\nfunction setup() { createCanvas(" + targetWidth + "," + targetHeight + "); }";
        }

        const executeCode = new Function('p', 'userCode', `
            with(p) {
                try {
                   eval(userCode);
                   return {
                       setup: typeof setup !== 'undefined' ? setup : null,
                       draw: typeof draw !== 'undefined' ? draw : null
                   };
                } catch(e) {
                    throw e;
                }
            }
        `);

        try {
            let userSetup = null;
            let userDraw = null;

            if (window.p5) {
                this.instance = new window.p5((p) => {
                    p._userNode = containerRef;
                    p._userWrapper = wrapperRef;

                    const originalCreateCanvas = p.createCanvas;
                    const originalResizeCanvas = p.resizeCanvas;

                    p.createCanvas = function (w, h, renderer) {
                        const result = originalCreateCanvas.call(p, targetWidth, targetHeight, renderer);

                        p.width = targetWidth;
                        p.height = targetHeight;

                        if (p.canvas) {
                            const targetParent = p._userWrapper;

                            if (targetParent) {
                                if (p.canvas.parentElement !== targetParent) {
                                    if (p.canvas.parentElement) p.canvas.parentElement.removeChild(p.canvas);
                                    targetParent.appendChild(p.canvas);
                                }

                                Array.from(targetParent.children).forEach(child => {
                                    if (child !== p.canvas && child !== containerRef && !child.classList.contains('st-stats-overlay')) {
                                        child.style.setProperty("display", "none", "important");
                                    }
                                });
                            }

                            p.canvas.style.width = "100%";
                            p.canvas.style.height = "100%";
                            p.canvas.style.objectFit = "contain";
                            p.canvas.style.setProperty("position", "static", "important");
                            p.canvas.style.removeProperty("top");
                            p.canvas.style.removeProperty("left");
                            p.canvas.style.margin = "0";
                            p.canvas.style.padding = "0";
                            p.canvas.style.zIndex = "50";
                            p.canvas.className = "";
                        }
                        return result;
                    };

                    p.resizeCanvas = function (w, h, noRedraw) {
                        if (p.width === targetWidth && p.height === targetHeight) return;

                        const result = originalResizeCanvas.call(p, targetWidth, targetHeight, noRedraw);
                        p.width = targetWidth;
                        p.height = targetHeight;
                        if (p.canvas) {
                            p.canvas.style.width = "100%";
                            p.canvas.style.height = "100%";
                        }
                        return result;
                    };

                    try {
                        const result = executeCode(p, processedCode);
                        userSetup = result.setup;
                        userDraw = result.draw;
                    } catch (e) {
                        console.error("Error executing user code:", e);
                        self._reportError(e);
                    }

                    p.preload = function () {
                        for (let i = 0; i < 4; i++) {
                            if (self._channelUrls[i]) {
                                try {
                                    self._channels[i] = p.loadImage(self._channelUrls[i]);
                                    p[`iChannel${i}`] = self._channels[i];
                                    console.log(`[P5Preview] Preloaded iChannel${i} for new instance: ${self._channelUrls[i]}`);
                                } catch (e) {
                                    console.error(`[P5Preview] Failed to preload iChannel${i}:`, e);
                                }
                            } else {
                                self._channels[i] = null;
                                p[`iChannel${i}`] = null;
                            }
                        }
                    };

                    p.setup = function () {
                        for (let i = 0; i < 4; i++) {
                            p[`iChannel${i}`] = self._channels[i] || null;
                        }

                        if (self.uniformValues) {
                            for (const key in self.uniformValues) {
                                p[key] = self.uniformValues[key];
                            }
                        }

                        p.frameRate(self._fpsLimit);
                        this.createCanvas(targetWidth, targetHeight);
                        if (userSetup) {
                            try {
                                userSetup.call(this);
                            } catch (e) {
                                self._reportError(e);
                            }
                        }
                    };

                    p.draw = function () {
                        if (this.width !== targetWidth) this.width = targetWidth;
                        if (this.height !== targetHeight) this.height = targetHeight;

                        const container = this._userNode;
                        let targetParent = container;
                        if (container && container.parentElement && container.parentElement.classList.contains('st-canvas')) {
                            targetParent = container.parentElement;
                        }

                        if (targetParent && this.canvas && this.canvas.parentElement !== targetParent) {
                            targetParent.appendChild(this.canvas);
                        }

                        const renderStart = performance.now();
                        if (userDraw) {
                            try {
                                userDraw.call(this);
                                if (self.onError) self.onError([]);
                                if (self.errorBox) self.errorBox.style.display = "none";
                            } catch (e) {
                                self._reportError(e);
                                self._fps = 0;
                                self._updateStats();
                                if (self._statsEl) self._statsEl.style.setProperty("display", "block", "important");
                                return;
                            }
                        }
                        self._lastRenderTime = performance.now() - renderStart;

                        const now = performance.now();
                        self._frameCount++;
                        if (now - self._lastFrameTime >= 1000) {
                            self._fps = self._frameCount;
                            self._frameCount = 0;
                            self._lastFrameTime = now;
                            self._updateStats();
                        }
                    };

                    p.windowResized = function () { };

                }, containerRef);

                window._p5Instances = window._p5Instances || {};
                window._p5Instances[this.instanceId] = this.instance;
            }
        } catch (err) {
            console.error("[P5Preview] Error initializing:", err);
            if (this.container) {
                this.container.innerHTML = "";
                const errorDiv = document.createElement("div");
                errorDiv.style.cssText = "color:red; padding:10px;";
                errorDiv.textContent = "Error: " + err.message;
                this.container.appendChild(errorDiv);
            }
        }
    }
    updateUniformValues(values) {
        this.uniformValues = values;
        if (this.instance) {
            for (const key in values) {
                this.instance[key] = values[key];
            }
        }
    }

    setUniformDefinitions(definitions) {
        this.uniformDefinitions = definitions;
    }
}
