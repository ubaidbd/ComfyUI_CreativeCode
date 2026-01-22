
import { app } from "/scripts/app.js";
import { transpileProcessingToJS } from "./transpiler.js";
import { P5Preview } from "./P5Preview.js";
import { ShaderPreview } from "./ShaderPreview.js";
import {
    logger,
    hideWidget,
    detectCodeType,
    ensureStyle,
    makeAccordion
} from "./utils.js";
import {
    DEFAULT_SHADER,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    NODE_DEFAULT_WIDTH,
    NODE_DEFAULT_HEIGHT,
    NODE_MIN_WIDTH,
    NODE_MIN_HEIGHT,
    DEBOUNCE_DELAY_MS,
    SIZE_DEBOUNCE_DELAY_MS,
    SYNC_POLLING_INTERVAL_MS,
    MONACO_LAYOUT_DELAY_MS,
    EDITOR_MIN_HEIGHT,
    THEME_BG_DARK,
    THEME_BG_MEDIUM,
    THEME_ACCENT_CYAN,
    THEME_TEXT_PRIMARY,
    THEME_TEXT_SECONDARY
} from "./constants.js";
import { parseUniforms, createUniformControl } from "./Uniforms.js";
import { createShaderLibraryUI } from "./ShaderLibrary.js";
import { createAIAssistantUI } from "./AIAssistant.js";
import * as CreativeCodeMonaco from "./MonacoEditor.js";

// Global singleton for the P5 transpiler
window.transpileProcessingToJS = transpileProcessingToJS;

app.registerExtension({
    name: "ComfyUI.CreativeCode",

    async setup() {
        /** Global hook to ensure P5 animations are baked before processing the queue */
        const originalQueuePrompt = app.queuePrompt;
        app.queuePrompt = async function (number, batchCount) {
            const graph = app.graph;
            if (!graph) return originalQueuePrompt.apply(this, arguments);

            const creativeCodeNodes = graph.findNodesByType("CreativeCodeRender");
            if (!creativeCodeNodes || creativeCodeNodes.length === 0) {
                return originalQueuePrompt.apply(this, arguments);
            }

            let needsBake = false;
            for (const node of creativeCodeNodes) {
                if (node.bakeP5Animation) {
                    needsBake = true;
                    break;
                }
            }

            if (needsBake) {
                const promises = [];
                for (const node of creativeCodeNodes) {
                    if (node.bakeP5Animation) {
                        promises.push(node.bakeP5Animation(null));
                    }
                }

                if (promises.length > 0) {
                    try {
                        console.log("[CreativeCode] Auto-baking P5 animations...");
                        await Promise.all(promises);
                        await new Promise(r => setTimeout(r, 200));
                    } catch (e) {
                        console.error("[CreativeCode] Auto-bake failed:", e);
                    }
                }
            }

            return originalQueuePrompt.apply(this, arguments);
        };
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CreativeCodeSettings") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);

                const selectWidget = this.widgets?.find(w => w.name === "select_shader");
                const codeWidget = this.widgets?.find(w => w.name === "shader_code");

                if (selectWidget && codeWidget) {
                    // Hook into callback to load shader code when selection changes
                    selectWidget.callback = async (value) => {
                        if (!value || value === "None") return;

                        try {
                            // Extract base filename for API request
                            let shaderName = value;
                            const lastSlash = shaderName.lastIndexOf("/");
                            if (lastSlash !== -1) shaderName = shaderName.substring(lastSlash + 1);

                            const lastDot = shaderName.lastIndexOf(".");
                            if (lastDot !== -1) shaderName = shaderName.substring(0, lastDot);

                            const res = await fetch(`/creativecode/shaders/${shaderName}`);
                            const data = await res.json();

                            if (data.code) {
                                codeWidget.value = data.code;
                                app.graph.setDirtyCanvas(true, true);
                            }
                        } catch (err) {
                            console.error("[CreativeCode] Failed to fetch shader preset:", err);
                        }
                    };
                }
            };
            return;
        }

        if (nodeData.name !== "CreativeCodeRender") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            ensureStyle();

            this.serialize_widgets = true;
            this.size = [NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT];

            // Boundary enforcement for node resizing
            this.onResize = function (size) {
                if (size[0] < NODE_MIN_WIDTH) size[0] = NODE_MIN_WIDTH;
                if (size[1] < NODE_MIN_HEIGHT) size[1] = NODE_MIN_HEIGHT;
            };

            const shaderWidget = this.widgets?.find(w => w.name === "shader_code");
            const widthWidget = this.widgets?.find(w => w.name === "width");
            const heightWidget = this.widgets?.find(w => w.name === "height");
            const framesWidget = this.widgets?.find(w => w.name === "frames");
            const fpsWidget = this.widgets?.find(w => w.name === "fps");
            const timeWidget = this.widgets?.find(w => w.name === "time_start");
            const customUniformWidget = this.widgets?.find(w => w.name === "custom_uniforms");
            const versionWidget = this.widgets?.find(w => w.name === "version_mode");
            const codeTypeWidget = this.widgets?.find(w => w.name === "code_type");
            const textureWrapWidget = this.widgets?.find(w => w.name === "texture_wrap");
            const textureFilterWidget = this.widgets?.find(w => w.name === "texture_filter");

            [shaderWidget, widthWidget, heightWidget, framesWidget, fpsWidget, timeWidget, customUniformWidget, versionWidget, codeTypeWidget, textureWrapWidget, textureFilterWidget].forEach(hideWidget);

            const root = document.createElement("div");
            root.className = "st-node";
            root.onmousedown = (e) => {
                if (e.target.tagName !== "CANVAS") e.stopPropagation();
            };

            const initialCode = shaderWidget?.value || DEFAULT_SHADER;
            let monacoInstance = null;
            let fallbackTextarea = null;

            const editor = {
                get value() {
                    if (monacoInstance) return monacoInstance.getValue();
                    if (fallbackTextarea) return fallbackTextarea.value;
                    return initialCode;
                },
                set value(val) {
                    if (monacoInstance) monacoInstance.setValue(val);
                    else if (fallbackTextarea) fallbackTextarea.value = val;
                },
                setErrors(errors) {
                    if (monacoInstance) monacoInstance.setErrors(errors);
                },
                goToLine(line) {
                    if (monacoInstance) monacoInstance.goToLine(line);
                },
                setLanguage(lang) {
                    if (monacoInstance) monacoInstance.setLanguage(lang);
                },
                addEventListener(event, handler) {
                    if (fallbackTextarea && event === "input") {
                        fallbackTextarea.addEventListener("input", handler);
                    }
                },
                focus() {
                    if (monacoInstance) monacoInstance.focus();
                    else if (fallbackTextarea) fallbackTextarea.focus();
                }
            };

            let triggerAiFix = null;

            /** Library and Preset Management UI */

            const libraryPlaceholder = document.createElement("div");
            createShaderLibraryUI(libraryPlaceholder, {
                onCodeLoaded: (code) => {
                    editor.value = code;
                    syncShader(code);
                },
                getCurrentCode: () => editor.value
            });


            const aiPlaceholder = document.createElement("div");
            const aiAssistant = createAIAssistantUI(aiPlaceholder, {
                getCurrentCode: () => editor.value,
                onApplyCode: (code) => {
                    editor.value = code;
                    syncShader(code);
                }
            });
            triggerAiFix = aiAssistant.triggerFix;



            const editorSection = document.createElement("div");
            editorSection.className = "st-section st-editor-section";
            editorSection.style.flex = "0 0 auto";
            editorSection.style.height = `${EDITOR_MIN_HEIGHT}px`;
            editorSection.style.display = "flex";
            editorSection.style.flexDirection = "column";
            editorSection.style.overflow = "hidden"; // Prevent external scrollbars

            const editorHeader = document.createElement("div");
            editorHeader.className = "st-title";
            editorHeader.style.display = "flex";
            editorHeader.style.justifyContent = "space-between";
            editorHeader.style.alignItems = "center";

            const editorTitleText = document.createElement("span");
            editorTitleText.textContent = "Code Editor";
            editorHeader.appendChild(editorTitleText);

            // Fullscreen toggle logic
            const fsBtn = document.createElement("span");
            fsBtn.textContent = "⛶";
            fsBtn.title = "Toggle Fullscreen";
            fsBtn.style.cursor = "pointer";
            fsBtn.style.fontSize = "14px";
            fsBtn.style.opacity = "0.7";
            fsBtn.style.padding = "0 4px";
            fsBtn.style.userSelect = "none";

            let editorPlaceholder = null;

            fsBtn.onclick = () => {
                const isFs = editorSection.classList.toggle("fullscreen");
                if (isFs) {
                    fsBtn.textContent = "✖";
                    fsBtn.title = "Exit Fullscreen";

                    // Preserve original layout position using a placeholder
                    editorPlaceholder = document.createElement("div");
                    editorPlaceholder.style.flex = "0 0 auto";
                    editorPlaceholder.style.height = `${EDITOR_MIN_HEIGHT}px`;
                    editorSection.parentNode.insertBefore(editorPlaceholder, editorSection);

                    // Reparent to document body for absolute positioning outside the node context
                    document.body.appendChild(editorSection);

                    Object.assign(editorSection.style, {
                        position: "fixed",
                        top: "0", left: "0", right: "0", bottom: "0",
                        zIndex: "10000",
                        background: THEME_BG_MEDIUM,
                        padding: "20px",
                        margin: "0",
                        height: "100vh",
                        flex: "1"
                    });
                } else {
                    fsBtn.textContent = "⛶";
                    fsBtn.title = "Toggle Fullscreen";

                    // Return editor to its original DOM hierarchy
                    if (editorPlaceholder && editorPlaceholder.parentNode) {
                        editorPlaceholder.parentNode.replaceChild(editorSection, editorPlaceholder);
                        editorPlaceholder = null;
                    }

                    Object.assign(editorSection.style, {
                        position: "", top: "", left: "", right: "", bottom: "",
                        zIndex: "", background: "", padding: "", margin: ""
                    });

                    editorSection.style.flex = "0 0 auto";
                    editorSection.style.height = `${EDITOR_MIN_HEIGHT}px`;
                    editorSection.style.display = "flex";
                    editorSection.style.flexDirection = "column";
                }

                setTimeout(() => {
                    if (monacoInstance && monacoInstance.editor) {
                        monacoInstance.editor.layout();
                    }
                }, 100);
            };
            editorHeader.appendChild(fsBtn);
            editorSection.appendChild(editorHeader);

            const editorContainer = document.createElement("div");
            editorContainer.className = "st-editor";
            editorContainer.style.flex = "1";
            editorContainer.style.position = "relative";
            editorContainer.style.minHeight = "0";
            editorSection.appendChild(editorContainer);

            const initEditor = async () => {
                try {
                    const codeType = detectCodeType(initialCode);
                    const lang = codeType === "p5" ? "javascript" : "glsl";

                    monacoInstance = await CreativeCodeMonaco.createMonacoEditor(
                        editorContainer,
                        initialCode,
                        lang,
                        (newValue) => {
                            if (shaderWidget) shaderWidget.value = newValue;
                            syncShaderDebounced?.(newValue);
                        },
                        (error) => {
                            if (triggerAiFix) triggerAiFix(error.message, error.line);
                        }
                    );
                    logger.info("Monaco Editor initialized");
                } catch (e) {
                    console.error("[CreativeCode] Monaco failed to initialize:", e);
                    createFallbackTextarea();
                }
            };

            const createFallbackTextarea = () => {
                fallbackTextarea = document.createElement("textarea");
                fallbackTextarea.className = "st-editor-fallback";
                fallbackTextarea.value = initialCode;
                fallbackTextarea.spellcheck = false;
                editorContainer.appendChild(fallbackTextarea);

                fallbackTextarea.addEventListener("input", (e) => {
                    if (shaderWidget) shaderWidget.value = e.target.value;
                    syncShaderDebounced?.(e.target.value);
                });
            };

            let syncShaderDebounced = null;

            const previewSection = document.createElement("div");
            previewSection.className = "st-section";
            const previewTitle = document.createElement("div");
            previewTitle.className = "st-title";
            previewTitle.textContent = "Quick Preview";
            const previewRow = document.createElement("div");
            previewRow.className = "st-preview";

            const canvasWrapper = document.createElement("div");
            canvasWrapper.className = "st-canvas";

            const glCanvas = document.createElement("canvas");
            glCanvas.className = "st-gl-canvas";
            glCanvas.width = PREVIEW_WIDTH;
            glCanvas.height = PREVIEW_HEIGHT;

            const p5Container = document.createElement("div");
            p5Container.className = "st-p5-container";
            p5Container.style.width = "100%";
            p5Container.style.height = "100%";

            canvasWrapper.appendChild(glCanvas);
            canvasWrapper.appendChild(p5Container);

            const statsOverlay = document.createElement("div");
            statsOverlay.className = "st-stats-overlay";
            statsOverlay.textContent = "--";
            canvasWrapper.appendChild(statsOverlay);

            const p5RestartBtn = document.createElement("div");
            p5RestartBtn.textContent = "🔄";
            p5RestartBtn.title = "Restart Sketch";
            Object.assign(p5RestartBtn.style, {
                position: "absolute",
                top: "6px",
                right: "6px",
                width: "24px",
                height: "24px",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                borderRadius: "4px",
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: "50",
                fontSize: "14px",
                border: "1px solid rgba(255,255,255,0.2)"
            });
            p5RestartBtn.onmouseover = () => p5RestartBtn.style.background = "rgba(0,0,0,0.8)";
            p5RestartBtn.onmouseout = () => p5RestartBtn.style.background = "rgba(0,0,0,0.6)";
            p5RestartBtn.onclick = () => {
                if (currentPreview && typeof currentPreview.start === 'function') {
                    currentPreview.start();
                }
            };
            canvasWrapper.appendChild(p5RestartBtn);

            const errorWrapper = document.createElement("div");
            errorWrapper.className = "st-error-wrapper";
            const errorBox = document.createElement("div");
            errorBox.className = "st-error";
            const fixOverlayBtn = document.createElement("div");
            fixOverlayBtn.className = "st-fix-btn";
            fixOverlayBtn.textContent = "Fix with AI";
            let currentErrors = [];

            fixOverlayBtn.onclick = () => {
                if (currentErrors && currentErrors.length > 0) {
                    const errorMsg = currentErrors.slice(0, 10).map(e => `Line ${e.line}: ${e.message}`).join("\n");
                    if (triggerAiFix) triggerAiFix(`Fix these errors:\n${errorMsg}`, currentErrors[0].line);
                }
            };

            errorWrapper.appendChild(errorBox);
            errorWrapper.appendChild(fixOverlayBtn);

            previewRow.appendChild(canvasWrapper);
            previewSection.appendChild(previewTitle);
            previewSection.appendChild(previewRow);
            previewSection.appendChild(errorWrapper);

            const statsPanel = document.createElement("div");
            statsPanel.className = "st-stats";
            const statsLine = statsOverlay;
            const warningLine = document.createElement("div");
            warningLine.className = "st-warning-line";
            const versionNote = document.createElement("div");
            versionNote.className = "st-version-note";
            statsPanel.appendChild(warningLine);
            previewSection.appendChild(statsPanel);

            const settingsSection = document.createElement("div");
            settingsSection.className = "st-section";
            const settingsTitle = document.createElement("div");
            settingsTitle.className = "st-title";
            settingsTitle.textContent = "Render Settings";

            const settingsGrid = document.createElement("div");
            settingsGrid.className = "st-settings-grid";

            const makeField = (label, value) => {
                const field = document.createElement("div");
                field.className = "st-field";
                const lbl = document.createElement("div");
                lbl.className = "st-label";
                lbl.textContent = label;
                const input = document.createElement("input");
                input.className = "st-input";
                input.value = value;
                field.appendChild(lbl);
                field.appendChild(input);
                return { field, input };
            };

            const makeSelectField = (label, options, value) => {
                const field = document.createElement("div");
                field.className = "st-field";
                const lbl = document.createElement("div");
                lbl.className = "st-label";
                lbl.textContent = label;
                const select = document.createElement("select");
                select.className = "st-input";
                options.forEach(opt => {
                    const option = document.createElement("option");
                    option.value = opt.value;
                    option.textContent = opt.label;
                    select.appendChild(option);
                });
                select.value = value;
                field.appendChild(lbl);
                field.appendChild(select);
                return { field, input: select };
            };

            const widthField = makeField("Width", widthWidget?.value ?? 640);
            const heightField = makeField("Height", heightWidget?.value ?? 360);
            const framesField = makeField("Frames", framesWidget?.value ?? 1);
            const fpsField = makeField("FPS", fpsWidget?.value ?? 24);
            const timeField = makeField("Start Time", timeWidget?.value ?? 0.0);

            const wrapOptions = [
                { label: "Repeat", value: "repeat" },
                { label: "Clamp", value: "clamp" },
                { label: "Mirror", value: "mirror" },
            ];
            const wrapField = makeSelectField("Texture Wrap", wrapOptions, textureWrapWidget?.value ?? "repeat");

            const filterOptions = [
                { label: "Linear (Smooth)", value: "linear" },
                { label: "Nearest (Pixel)", value: "nearest" },
            ];
            const filterField = makeSelectField("Texture Filter", filterOptions, textureFilterWidget?.value ?? "linear");

            [widthField, heightField, framesField, fpsField, timeField, wrapField, filterField].forEach(({ field }) => {
                settingsGrid.appendChild(field);
            });

            const bindSelect = (inputEl, widget) => {
                inputEl.addEventListener("change", () => {
                    if (widget) widget.value = inputEl.value;
                });
            };
            bindSelect(wrapField.input, textureWrapWidget);
            bindSelect(filterField.input, textureFilterWidget);


            const interactionWarning = document.createElement("div");
            interactionWarning.style.display = "none";
            interactionWarning.style.marginTop = "6px";
            interactionWarning.style.padding = "4px 8px";
            interactionWarning.style.background = "rgba(255, 180, 0, 0.1)";
            interactionWarning.style.border = "1px solid rgba(255, 180, 0, 0.3)";
            interactionWarning.style.borderRadius = "4px";
            interactionWarning.style.fontSize = "10px";
            interactionWarning.style.color = "#ffb400";
            interactionWarning.textContent = "⚠️ Code uses mouse/keyboard - not supported in video render";

            const p5BackendWarning = document.createElement("div");
            p5BackendWarning.style.display = "none";
            p5BackendWarning.style.marginTop = "8px";
            p5BackendWarning.style.padding = "8px 12px";
            p5BackendWarning.style.background = "rgba(255, 100, 0, 0.15)";
            p5BackendWarning.style.border = "1px solid rgba(255, 100, 0, 0.4)";
            p5BackendWarning.style.borderRadius = "4px";
            p5BackendWarning.style.fontSize = "11px";
            p5BackendWarning.style.color = "#ff6400";
            p5BackendWarning.innerHTML = `<strong>P5.js Rendering Mode</strong><br>Animations are captured via browser (Baking). It will automatically prepare when you click <b>Queue Prompt</b>.`;

            const inputOverrideWarning = document.createElement("div");
            inputOverrideWarning.style.display = "none";
            inputOverrideWarning.style.marginTop = "8px";
            inputOverrideWarning.style.padding = "8px 12px";
            inputOverrideWarning.style.background = "rgba(100, 150, 255, 0.12)";
            inputOverrideWarning.style.border = "1px solid rgba(100, 150, 255, 0.4)";
            inputOverrideWarning.style.borderRadius = "4px";
            inputOverrideWarning.style.fontSize = "10px";
            inputOverrideWarning.style.color = "#8ab4ff";
            inputOverrideWarning.innerHTML = `<strong>🔗 Input Override Active</strong><br>Dimensions or textures are being controlled by external nodes.`;

            const bakeWrapper = document.createElement("div");
            bakeWrapper.style.display = "none";
            bakeWrapper.style.flexDirection = "column";
            bakeWrapper.style.gap = "4px";
            bakeWrapper.style.marginTop = "10px";
            bakeWrapper.style.padding = "10px";
            bakeWrapper.style.background = "rgba(233, 30, 99, 0.05)";
            bakeWrapper.style.border = "1px solid rgba(233, 30, 99, 0.1)";
            bakeWrapper.style.borderRadius = "6px";

            const bakeBtn = document.createElement("button");
            bakeBtn.className = "st-btn";
            bakeBtn.style.width = "100%";
            bakeBtn.style.padding = "8px";
            bakeBtn.style.backgroundColor = "transparent";
            bakeBtn.style.border = "1px solid #e91e63";
            bakeBtn.style.color = "#e91e63";
            bakeBtn.style.fontWeight = "bold";
            bakeBtn.style.borderRadius = "4px";
            bakeBtn.style.cursor = "pointer";
            bakeBtn.style.display = "flex";
            bakeBtn.style.alignItems = "center";
            bakeBtn.style.justifyContent = "center";
            bakeBtn.style.gap = "8px";
            bakeBtn.style.transition = "all 0.2s ease";

            const bakeIcon = document.createElement("span");
            bakeIcon.textContent = "🔴";
            const bakeLabel = document.createElement("span");
            bakeLabel.textContent = "Bake Animation";

            bakeBtn.appendChild(bakeIcon);
            bakeBtn.appendChild(bakeLabel);
            bakeBtn.onmouseover = () => { bakeBtn.style.background = "rgba(233, 30, 99, 0.1)"; };
            bakeBtn.onmouseout = () => { bakeBtn.style.background = "transparent"; };

            const bakeInfo = document.createElement("div");
            bakeInfo.textContent = "Auto-active during Queue Prompt";
            bakeInfo.style.fontSize = "9px";
            bakeInfo.style.color = "#888";
            bakeInfo.style.textAlign = "center";
            bakeInfo.style.opacity = "0.8";

            const bakeProgress = document.createElement("div");
            bakeProgress.style.height = "3px";
            bakeProgress.style.width = "100%";
            bakeProgress.style.background = "rgba(0,0,0,0.3)";
            bakeProgress.style.marginTop = "6px";
            bakeProgress.style.display = "none";
            bakeProgress.style.borderRadius = "2px";
            bakeProgress.style.overflow = "hidden";

            const bakeProgressFill = document.createElement("div");
            bakeProgressFill.style.height = "100%";
            bakeProgressFill.style.width = "0%";
            bakeProgressFill.style.background = "#e91e63";
            bakeProgressFill.style.transition = "width 0.2s ease";
            bakeProgress.appendChild(bakeProgressFill);

            bakeWrapper.appendChild(bakeBtn);
            bakeWrapper.appendChild(bakeProgress);
            bakeWrapper.appendChild(bakeInfo);

            let bakeInProgress = false;
            this.bakeP5Animation = async (event = null) => {
                if (bakeInProgress) {
                    console.warn("[CreativeCode] Bake already in progress");
                    return false;
                }
                bakeInProgress = true;

                const codeWidget = this.widgets?.find(w => w.name === "shader_code");
                const codeContent = codeWidget ? codeWidget.value : (editor?.value || "");
                const codeType = detectCodeType(codeContent);
                if (codeType !== "p5") {
                    bakeInProgress = false;
                    return false;
                }

                const p5InstanceId = currentPreview?.instanceId;
                let p5Instance = p5InstanceId ? window._p5Instances?.[p5InstanceId] : null;
                if (!p5Instance) {
                    if (typeof createPreview === 'function') createPreview("p5");
                    if (currentPreview && typeof currentPreview.setSource === 'function') currentPreview.setSource(codeContent);
                    for (let i = 0; i < 10; i++) {
                        await new Promise(r => setTimeout(r, 200));
                        const newId = currentPreview?.instanceId;
                        p5Instance = newId ? window._p5Instances?.[newId] : null;
                        if (p5Instance) break;
                    }
                }

                if (!p5Instance) {
                    if (event) alert("P5 instance not found. Please click 'Reset' or edit code to refresh.");
                    bakeInProgress = false;
                    return false;
                }

                const totalFrames = parseInt(framesWidget?.value || "24");
                const cacheId = "p5_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

                bakeBtn.disabled = true;
                const originalLabel = bakeLabel.textContent;
                bakeLabel.textContent = "BAKING...";
                bakeProgress.style.display = "block";
                bakeProgressFill.style.width = "0%";

                try {
                    p5Instance.frameCount = 0;
                    if (p5Instance.setup) p5Instance.setup();
                    await new Promise(r => setTimeout(r, 100));

                    for (let i = 0; i < totalFrames; i++) {
                        const pct = Math.round(((i + 1) / totalFrames) * 100);
                        bakeProgressFill.style.width = pct + "%";
                        bakeLabel.textContent = `BAKING FRAME ${i + 1}/${totalFrames}`;

                        p5Instance.frameCount = i;
                        p5Instance.redraw();
                        await new Promise(r => setTimeout(r, 50));

                        const canvas = p5Instance.canvas;
                        if (!canvas) throw new Error("Canvas missing");

                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                        const formData = new FormData();
                        formData.append("cache_id", cacheId);
                        formData.append("image", blob, `frame_${String(i).padStart(5, '0')}.png`);

                        const res = await fetch("/creativecode/upload_canvas_frame", { method: "POST", body: formData });
                        if (!res.ok) throw new Error(await res.text());
                    }

                    bakeLabel.textContent = "✅ READY";
                    bakeBtn.style.borderColor = "#4caf50";
                    bakeBtn.style.color = "#4caf50";
                    bakeProgress.style.display = "none";

                    const uniformWidgetIndex = this.widgets?.findIndex(w => w.name === "custom_uniforms");
                    const targetUniformWidget = uniformWidgetIndex >= 0 ? this.widgets[uniformWidgetIndex] : customUniformWidget;
                    let currentUniforms = {};
                    if (targetUniformWidget && targetUniformWidget.value) {
                        try { currentUniforms = JSON.parse(targetUniformWidget.value); } catch (e) { }
                    }
                    currentUniforms["_p5_uid"] = cacheId;
                    const newVal = JSON.stringify(currentUniforms, null, 2);
                    if (targetUniformWidget) {
                        targetUniformWidget.value = newVal;
                        if (this.widgets_values && uniformWidgetIndex >= 0) this.widgets_values[uniformWidgetIndex] = newVal;
                    }
                    this.widgets_values = null;
                    if (app.graph && app.graph.setDirtyCanvas) app.graph.setDirtyCanvas(true, true);

                    setTimeout(() => {
                        bakeBtn.disabled = false;
                        bakeLabel.textContent = originalLabel;
                        bakeBtn.style.borderColor = "#e91e63";
                        bakeBtn.style.color = "#e91e63";
                    }, 4000);

                } catch (e) {
                    console.error("Bake failed:", e);
                    if (event) alert("Bake failed: " + e.message);
                    bakeBtn.disabled = false;
                    bakeLabel.textContent = originalLabel;
                    bakeProgress.style.display = "none";
                    bakeInProgress = false;
                    return false;
                }
                bakeInProgress = false;
                return true;
            };

            bakeBtn.onclick = async (e) => { await this.bakeP5Animation(e); };
            const nodeRef = this;

            const getConnectedSettingsNode = () => {
                const settingsInput = nodeRef.inputs?.find(inp => inp.name === "settings");
                if (!settingsInput || settingsInput.link == null) return null;

                const link = app.graph.links[settingsInput.link];
                if (!link) return null;

                const sourceNode = app.graph.getNodeById(link.origin_id);
                return sourceNode;
            };

            const syncFromSettingsNode = () => {
                const settingsNode = getConnectedSettingsNode();
                if (!settingsNode) {
                    return false;
                }

                const getWidgetValue = (name) => {
                    const widget = settingsNode.widgets?.find(w => w.name === name);
                    return widget?.value;
                };

                const newCode = getWidgetValue("shader_code");
                const newWidth = getWidgetValue("width");
                const newHeight = getWidgetValue("height");

                if (newCode && newCode !== editor.value) {
                    editor.value = newCode;
                    syncShader(newCode);
                    logger.debug("Synced shader_code from Settings node");
                }

                let sizeChanged = false;
                if (newWidth != null && Number(widthField.input.value) !== newWidth) {
                    widthField.input.value = newWidth;
                    if (widthWidget) widthWidget.value = newWidth;
                    sizeChanged = true;
                }
                if (newHeight != null && Number(heightField.input.value) !== newHeight) {
                    heightField.input.value = newHeight;
                    if (heightWidget) heightWidget.value = newHeight;
                    sizeChanged = true;
                }

                if (sizeChanged) {
                    clearTimeout(sizeDebounceTimer);
                    sizeDebounceTimer = setTimeout(() => {
                        if (currentPreview && editor.value) {
                            const currentType = detectCodeType(editor.value);
                            createPreview(currentType);
                            currentPreview?.setSource?.(editor.value);
                        }
                    }, SIZE_DEBOUNCE_DELAY_MS);
                }

                const newFrames = getWidgetValue("frames");
                const newFps = getWidgetValue("fps");
                const newTimeStart = getWidgetValue("time_start");

                if (newFrames != null) framesField.input.value = newFrames;
                if (newFps != null) fpsField.input.value = newFps;
                if (newTimeStart != null) timeField.input.value = newTimeStart;

                return true;
            };

            const checkInputConnections = () => {
                const hasSettingsInput = nodeRef.inputs?.some(inp => inp.name === "settings" && inp.link != null);
                const hasChannelsInput = nodeRef.inputs?.some(inp => inp.name === "channels" && inp.link != null);
                if (hasSettingsInput && hasChannelsInput) {
                    inputOverrideWarning.innerHTML = `<strong>🔗 Input Override Active</strong><br>Settings and textures are connected via external nodes.`;
                    inputOverrideWarning.style.display = "block";
                } else if (hasSettingsInput) {
                    inputOverrideWarning.innerHTML = `<strong>🔗 Settings Override</strong><br>Dimensions and settings are controlled by the Settings node.`;
                    inputOverrideWarning.style.display = "block";
                } else if (hasChannelsInput) {
                    inputOverrideWarning.innerHTML = `<strong>🔗 Channels Active</strong><br>External textures (iChannels) are connected.`;
                    inputOverrideWarning.style.display = "block";
                } else {
                    inputOverrideWarning.style.display = "none";
                }

                settingsOverlay.style.display = hasSettingsInput ? "flex" : "none";
                settingsGrid.style.opacity = hasSettingsInput ? "0.3" : "1";
                settingsGrid.style.pointerEvents = hasSettingsInput ? "none" : "auto";

                if (hasSettingsInput) {
                    syncFromSettingsNode();
                }

                if (hasChannelsInput) {
                    syncChannelImages();
                }
            };

            const syncChannelImages = () => {
                const channelsInput = nodeRef.inputs?.find(inp => inp.name === "channels");
                if (!channelsInput || channelsInput.link == null) return;

                const link = app.graph.links[channelsInput.link];
                if (!link) return;

                const channelsNode = app.graph.getNodeById(link.origin_id);
                if (!channelsNode) return;

                for (let i = 0; i < 4; i++) {
                    const channelInputName = `iChannel${i}`;
                    const channelInput = channelsNode.inputs?.find(inp => inp.name === channelInputName);

                    if (channelInput && channelInput.link != null) {
                        const imgLink = app.graph.links[channelInput.link];
                        if (imgLink) {
                            const sourceNode = app.graph.getNodeById(imgLink.origin_id);
                            if (sourceNode) {
                                const imageWidget = sourceNode.widgets?.find(w => w.name === "image");
                                if (imageWidget && imageWidget.value) {
                                    const imageUrl = `/view?filename=${encodeURIComponent(imageWidget.value)}&type=input`;
                                    currentPreview?.setChannelImage?.(i, imageUrl);
                                    logger.debug(`Synced iChannel${i} from ${sourceNode.title}: ${imageWidget.value}`);
                                }
                            }
                        }
                    } else {
                        currentPreview?.clearChannelImage?.(i);
                    }
                }

                // Sync Texture Options
                const wrapWidget = channelsNode.widgets?.find(w => w.name === "texture_wrap");
                const filterWidget = channelsNode.widgets?.find(w => w.name === "texture_filter");

                if (currentPreview && (wrapWidget || filterWidget)) {
                    const wrap = wrapWidget ? wrapWidget.value : "repeat";
                    const filter = filterWidget ? filterWidget.value : "linear";
                    currentPreview.setTextureOptions?.(wrap, filter);
                }
            };

            const origOnConnectionsChange = this.onConnectionsChange;
            this.onConnectionsChange = function (type, index, connected, linkInfo) {
                origOnConnectionsChange?.apply(this, arguments);
                checkInputConnections();
            };

            // Initial connection check
            setTimeout(checkInputConnections, 100);

            // Keep inputs in sync with external nodes every second
            const syncPollingInterval = setInterval(() => {
                const hasSettingsInput = nodeRef.inputs?.some(inp => inp.name === "settings" && inp.link != null);
                const hasChannelsInput = nodeRef.inputs?.some(inp => inp.name === "channels" && inp.link != null);
                if (hasSettingsInput) {
                    syncFromSettingsNode();
                }
                if (hasChannelsInput) {
                    syncChannelImages();
                }
            }, SYNC_POLLING_INTERVAL_MS);

            const settingsOverlay = document.createElement("div");
            settingsOverlay.style.display = "none";
            settingsOverlay.style.position = "absolute";
            settingsOverlay.style.top = "0";
            settingsOverlay.style.left = "0";
            settingsOverlay.style.right = "0";
            settingsOverlay.style.bottom = "0";
            settingsOverlay.style.background = "rgba(30, 40, 60, 0.85)";
            settingsOverlay.style.borderRadius = "6px";
            settingsOverlay.style.justifyContent = "center";
            settingsOverlay.style.alignItems = "center";
            settingsOverlay.style.flexDirection = "column";
            settingsOverlay.style.gap = "6px";
            settingsOverlay.style.zIndex = "10";
            settingsOverlay.innerHTML = `
                <div style="font-size: 14px; font-weight: 600; color: #8ab4ff;">🔗 Using Settings Node</div>
                <div style="font-size: 10px; color: #aaa;">Edit values in the connected CreativeCode Settings node</div>
            `;

            const settingsContent = document.createElement("div");
            settingsContent.style.position = "relative";

            settingsContent.appendChild(settingsGrid);
            settingsContent.appendChild(settingsOverlay);
            settingsContent.appendChild(inputOverrideWarning);
            settingsContent.appendChild(interactionWarning);
            settingsContent.appendChild(p5BackendWarning);
            settingsContent.appendChild(bakeWrapper);
            settingsContent.appendChild(versionNote);

            makeAccordion(settingsSection, settingsTitle, settingsContent, true);

            const MAX_CANVAS_SIZE = 4096;

            const analyzeP5Code = (code) => {
                const result = {
                    hasCreateCanvas: false,
                    canvasWidth: null,
                    canvasHeight: null,
                    usesInteraction: false,
                    sizeWarning: null
                };

                const canvasMatch = code.match(/createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)/);
                if (canvasMatch) {
                    result.hasCreateCanvas = true;
                    let width = parseInt(canvasMatch[1], 10);
                    let height = parseInt(canvasMatch[2], 10);

                    if (width > MAX_CANVAS_SIZE || height > MAX_CANVAS_SIZE) {
                        result.sizeWarning = `Canvas size (${width}x${height}) exceeds limit (${MAX_CANVAS_SIZE}). Will be clamped.`;
                        width = Math.min(width, MAX_CANVAS_SIZE);
                        height = Math.min(height, MAX_CANVAS_SIZE);
                    }

                    if (width < 1 || height < 1 || !Number.isFinite(width) || !Number.isFinite(height)) {
                        result.sizeWarning = "Invalid canvas size detected. Using defaults.";
                        width = 640;
                        height = 360;
                    }

                    result.canvasWidth = width;
                    result.canvasHeight = height;
                }

                const interactionPatterns = /\b(mouseX|mouseY|mousePressed|mouseClicked|mouseMoved|mouseDragged|keyPressed|keyReleased|keyTyped|key|keyCode)\b/;
                result.usesInteraction = interactionPatterns.test(code);

                return result;
            };

            // Update UI components based on P5.js specific code analysis
            const updateP5Options = (code) => {
                const analysis = analyzeP5Code(code);
                const isP5 = detectCodeType(code) === "p5";

                interactionWarning.style.display = (isP5 && analysis.usesInteraction) ? "block" : "none";
                p5BackendWarning.style.display = isP5 ? "block" : "none";
                bakeWrapper.style.display = isP5 ? "flex" : "none";

                return analysis;
            };

            /** Dynamic Uniforms UI Section */
            const uniformSection = document.createElement("div");
            uniformSection.className = "st-section";
            const uniformTitle = document.createElement("div");
            uniformTitle.className = "st-title";
            uniformTitle.textContent = "Detected Uniforms";

            const uniformContainer = document.createElement("div");
            uniformContainer.className = "st-uniform-grid";

            makeAccordion(uniformSection, uniformTitle, uniformContainer, false);

            const mainLayout = document.createElement("div");
            mainLayout.className = "st-main-layout";
            mainLayout.style.display = "flex";
            mainLayout.style.flexDirection = "column";
            mainLayout.style.width = "100%";
            mainLayout.style.gap = "0px";
            mainLayout.style.flexShrink = "0";

            previewSection.style.flexShrink = "0";
            previewSection.style.paddingBottom = "4px";
            previewSection.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

            const editorGroup = document.createElement("div");
            editorGroup.style.display = "flex";
            editorGroup.style.flexDirection = "column";
            editorGroup.style.gap = "0px";
            editorGroup.style.flex = "1";
            editorGroup.style.minWidth = "0";

            editorGroup.appendChild(editorSection);
            editorGroup.appendChild(aiPlaceholder);

            mainLayout.appendChild(previewSection);

            libraryPlaceholder.style.width = "100%";
            mainLayout.appendChild(libraryPlaceholder);

            mainLayout.appendChild(editorGroup);

            root.appendChild(mainLayout);

            const scrollContent = document.createElement("div");
            scrollContent.className = "st-scroll-content";
            scrollContent.appendChild(uniformSection);
            scrollContent.appendChild(settingsSection);

            root.appendChild(scrollContent);

            const origResizer = this.onResize;
            /** Adaptive UI Layout Logic */
            const syncLayout = (size) => {
                const nodeSize = size || this.size;
                if (!nodeSize) return;

                const rW = parseInt(widthWidget?.value || widthField?.input?.value || "640");
                const rH = parseInt(heightWidget?.value || heightField?.input?.value || "360");
                const aspectRatio = rW / rH;

                const requiredPreviewWidth = rW + 30;
                const minEditorSafeWidth = 400;

                if (nodeSize[0] > (requiredPreviewWidth + minEditorSafeWidth)) {
                    mainLayout.style.flexDirection = "row";
                    mainLayout.style.alignItems = "stretch";

                    previewSection.style.flex = `0 0 ${requiredPreviewWidth}px`;
                    previewSection.style.width = `${requiredPreviewWidth}px`;
                    previewSection.style.borderBottom = "none";
                    previewSection.style.borderRight = "1px solid rgba(255,255,255,0.1)";
                    previewSection.style.paddingBottom = "0";
                    previewSection.style.paddingRight = "15px";

                    editorGroup.style.marginLeft = "15px";
                    editorGroup.style.marginTop = "0";

                    if (libraryPlaceholder.parentNode !== editorGroup) {
                        editorGroup.insertBefore(libraryPlaceholder, editorGroup.firstChild);
                    }
                } else {
                    mainLayout.style.flexDirection = "column";

                    previewSection.style.flex = "none";
                    previewSection.style.width = "100%";
                    previewSection.style.borderRight = "none";
                    previewSection.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
                    previewSection.style.paddingRight = "0";
                    previewSection.style.paddingBottom = "4px";

                    if (libraryPlaceholder.parentNode !== mainLayout) {
                        mainLayout.insertBefore(libraryPlaceholder, editorGroup);
                    }
                    previewSection.style.paddingBottom = "4px";

                    editorGroup.style.marginLeft = "0";
                    editorGroup.style.marginTop = "4px";
                }

                const availableWidth = previewSection.clientWidth - 24;
                const targetW = Math.min(rW, availableWidth);
                const targetH = targetW / aspectRatio;

                canvasWrapper.style.width = `${targetW}px`;
                canvasWrapper.style.height = `${targetH}px`;

                if (glCanvas) {
                    glCanvas.width = rW;
                    glCanvas.height = rH;
                }
            };

            this.onResize = function (size) {
                if (origResizer) origResizer.apply(this, arguments);
                syncLayout(size);
            };

            /** Node Expansion & Scrolling UX Controls */
            const scrollIndicator = document.createElement("div");
            scrollIndicator.className = "st-scroll-indicator";
            scrollIndicator.style.pointerEvents = "auto";
            scrollIndicator.style.cursor = "pointer";
            scrollIndicator.title = "Click to toggle node size";
            scrollIndicator.innerHTML = "<span>▼ EXPAND</span>";
            root.appendChild(scrollIndicator);

            this._isExpanded = false;

            scrollIndicator.onclick = (e) => {
                e.stopPropagation();

                if (!this._isExpanded) {
                    if (!this._savedHeight || this.size[1] < 1200) {
                        this._savedHeight = this.size[1];
                    }

                    const overflow = Math.max(0, scrollContent.scrollHeight - scrollContent.clientHeight);
                    if (overflow > 0) this.size[1] += overflow + 150;

                    this._isExpanded = true;
                    this._expandTimestamp = Date.now();
                    scrollIndicator.innerHTML = "<span>▲ COLLAPSE</span>";
                } else {
                    this.size[1] = this._savedHeight || 760;
                    this._isExpanded = false;
                    scrollIndicator.innerHTML = "<span>▼ EXPAND</span>";
                }

                if (this.setSize) this.setSize(this.size);
                setTimeout(() => {
                    this.setDirtyCanvas(true);
                    updateScrollVisibility();
                }, 100);
            };

            const updateScrollVisibility = () => {
                if (!scrollContent || !scrollIndicator) return;
                const isScrollable = scrollContent.scrollHeight > scrollContent.clientHeight + 5;
                const isAtBottom = scrollContent.scrollTop + scrollContent.clientHeight >= scrollContent.scrollHeight - 30;

                if (isScrollable && this._isExpanded) {
                    if (Date.now() - (this._expandTimestamp || 0) >= 1000) {
                        this._isExpanded = false;
                        scrollIndicator.innerHTML = "<span>▼ EXPAND</span>";
                    }
                }

                if (this._isExpanded || isScrollable) {
                    scrollIndicator.classList.add("visible");
                } else {
                    scrollIndicator.classList.remove("visible");
                }
            };

            scrollContent.addEventListener("scroll", updateScrollVisibility);
            setTimeout(updateScrollVisibility, 500);

            const layoutStyle = document.createElement("style");
            layoutStyle.textContent = `
                .st-main-layout { transition: flex-direction 0.2s ease; flex-shrink: 0; }
                .st-main-layout > .st-section { min-width: 0; flex-shrink: 0; }
                .st-scroll-content {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding-right: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    min-height: 0;
                    margin-top: 10px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    padding-top: 10px;
                }
                .st-section { flex-shrink: 0; }
                .st-node { overflow: hidden !important; position: relative; }
                .st-editor { flex: 1; min-height: 300px; display: flex; flex-direction: column; flex-shrink: 0; }
                .st-editor textarea { flex: 1; }
                .st-preview-stats { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                .st-scroll-indicator {
                    position: absolute;
                    bottom: 12px;
                    left: 50%;
                    transform: translateX(-50%) translateY(10px);
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(4px);
                    color: #fff;
                    padding: 4px 14px;
                    border-radius: 20px;
                    font-size: 9px;
                    font-weight: 800;
                    letter-spacing: 0.8px;
                    border: 1px solid rgba(255,255,255,0.15);
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 100;
                    pointer-events: none;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .st-scroll-indicator.visible {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                .st-scroll-indicator span {
                    background: linear-gradient(90deg, #fff, #aaa);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
            `;
            root.appendChild(layoutStyle);

            this.addDOMWidget("shader_ui", "shader_ui", root, {
                serialize: false,
                hideOnZoom: false,
            });

            let currentPreview = null;
            let currentCodeType = "glsl";
            // Synchronize internal state with the node's version widget
            const updateCodeTypeWidget = (value) => {
                const detected = detectCodeType(value);
                currentCodeType = detected;
                if (codeTypeWidget) codeTypeWidget.value = detected;
                return detected;
            };

            // Toggle visibility between WebGL and P5.js layers
            const showPreviewLayer = (type) => {
                if (type === "p5") {
                    glCanvas.style.display = "none";
                    p5Container.style.display = "flex";
                    p5Container.style.visibility = "visible";
                    p5Container.offsetHeight; // Force reflow to ensure clean state before restart
                    if (p5RestartBtn) p5RestartBtn.style.display = "flex";
                } else {
                    glCanvas.style.display = "block";
                    p5Container.style.display = "none";
                    if (p5RestartBtn) p5RestartBtn.style.display = "none";
                }
            };

            const createPreview = (type) => {
                try {
                    if (currentPreview) currentPreview.stop();

                    showPreviewLayer(type);

                    // Ensure stats overlay is always visible after mode switch
                    statsOverlay.style.display = "";

                    let renderWidth = parseInt(widthWidget?.value ?? widthField?.input?.value ?? PREVIEW_WIDTH);
                    let renderHeight = parseInt(heightWidget?.value ?? heightField?.input?.value ?? PREVIEW_HEIGHT);
                    let renderFps = parseFloat(fpsWidget?.value ?? fpsField?.input?.value ?? 24);

                    p5Container.style.position = "absolute";
                    p5Container.style.inset = "0";
                    p5Container.style.overflow = "hidden";
                    p5Container.style.display = type === "p5" ? "flex" : "none";
                    p5Container.style.alignItems = "center";
                    p5Container.style.justifyContent = "center";

                    let previewInstance;
                    if (type === "p5") {
                        if (glCanvas) glCanvas.style.display = "none";
                        if (typeof P5Preview === 'undefined') {
                            throw new Error("P5Preview module failed to load.");
                        }
                        previewInstance = new P5Preview(p5Container, errorBox, renderWidth, renderHeight, canvasWrapper, (errors) => {
                            editor.setErrors?.(errors);
                            if ((errors && errors.length > 0) || (errorBox.textContent && errorBox.textContent.trim() !== "")) {
                                errorWrapper.style.display = "block";
                                currentErrors = errors || [];
                            } else {
                                errorWrapper.style.display = "none";
                                currentErrors = [];
                            }
                        });
                        previewInstance.setStatsElements({ statsEl: statsLine });
                    } else {
                        p5Container.style.display = "none";
                        if (glCanvas) glCanvas.style.display = "block";
                        previewInstance = new ShaderPreview(glCanvas, errorBox, (errors) => {
                            editor.setErrors?.(errors);

                            if ((errors && errors.length > 0) || (errorBox.textContent && errorBox.textContent.trim() !== "")) {
                                errorWrapper.style.display = "block";
                                currentErrors = errors || [];
                            } else {
                                errorWrapper.style.display = "none";
                                currentErrors = [];
                            }
                        });
                        previewInstance.setStatsElements({ statsEl: statsLine, warningEl: warningLine, versionEl: versionNote });
                        previewInstance.setVersionMode("auto");

                        glCanvas.width = renderWidth;
                        glCanvas.height = renderHeight;
                        glCanvas.style.width = "100%";
                        glCanvas.style.height = "100%";
                        glCanvas.style.display = "block";
                    }
                    if (previewInstance && typeof previewInstance.setFPS === "function") {
                        previewInstance.setFPS(renderFps);
                    }
                    previewInstance.start();
                    currentPreview = previewInstance;

                    setTimeout(() => checkInputConnections(), 100);
                    syncLayout();
                } catch (err) {
                    console.error("[CreativeCode] createPreview Error:", err);
                    errorBox.textContent = `Preview Error: ${err.message}`;
                    errorBox.style.display = "block";
                }
            };

            let uniformValues = {};
            const updateUniformWidgetValue = () => {
                if (customUniformWidget) {
                    customUniformWidget.value = JSON.stringify(uniformValues);
                }
            };

            const rebuildUniformControls = (code) => {
                uniformContainer.innerHTML = "";
                uniformValues = {};

                const uniformPlaceholder = document.createElement("div");
                uniformPlaceholder.className = "st-uniform-placeholder";
                uniformPlaceholder.textContent = "No uniforms detected.";

                const definitions = parseUniforms(code);

                if (!definitions.length) {
                    if (currentCodeType === "p5") {
                        uniformPlaceholder.innerHTML = "No uniforms detected.<br><span style='font-size: 8px; opacity: 0.5;'>Tip: use // @uniform float speed = 1.0</span>";
                    }
                    uniformContainer.appendChild(uniformPlaceholder);
                    currentPreview?.setUniformDefinitions?.([]);
                    currentPreview?.updateUniformValues?.({});
                    updateUniformWidgetValue();
                    return;
                }
                definitions.forEach(def => {
                    const control = createUniformControl(def, (value) => {
                        uniformValues[def.name] = value;
                        currentPreview?.updateUniformValues?.(uniformValues);
                        updateUniformWidgetValue();
                        this.setDirtyCanvas(true);
                    });
                    uniformContainer.appendChild(control.el);
                    uniformValues[def.name] = control.getValue();
                });
                currentPreview?.setUniformDefinitions?.(definitions);
                currentPreview?.updateUniformValues?.(uniformValues);
                updateUniformWidgetValue();
            };

            const initPreview = (value) => {
                const type = updateCodeTypeWidget(value);
                createPreview(type);
                rebuildUniformControls(value);
                if (currentPreview) currentPreview.setSource(value);
            };

            initPreview(editor.value);

            let debounceTimer = null;
            const syncShader = (value) => {
                if (shaderWidget) shaderWidget.value = value;
                const detected = detectCodeType(value);

                updateP5Options(value);

                if (detected !== currentCodeType) {
                    currentCodeType = detected;
                    createPreview(detected);

                    const lang = detected === "p5" ? "javascript" : "glsl";
                    editor.setLanguage?.(lang);
                }
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    rebuildUniformControls(value);
                    currentPreview?.setSource?.(value);
                    this.setDirtyCanvas(true);
                }, DEBOUNCE_DELAY_MS);
            };

            syncShaderDebounced = syncShader;

            initEditor();

            editor.addEventListener("input", (e) => {
                syncShader(e.target.value);
            });

            const bindNumber = (inputEl, widget) => {
                inputEl.type = "number";
                inputEl.addEventListener("input", () => {
                    const value = Number(inputEl.value);
                    if (widget) widget.value = value;
                    this.setDirtyCanvas(true);
                });
            };

            let sizeDebounceTimer = null;
            const bindSizeField = (inputEl, widget) => {
                inputEl.type = "number";
                inputEl.addEventListener("input", () => {
                    const value = Number(inputEl.value);
                    if (widget) widget.value = value;
                    this.setDirtyCanvas(true);

                    clearTimeout(sizeDebounceTimer);
                    sizeDebounceTimer = setTimeout(() => {
                        if (currentPreview && editor.value) {
                            const currentType = detectCodeType(editor.value);
                            const currentCode = editor.value;
                            createPreview(currentType);
                            if (currentPreview) {
                                currentPreview.setSource(currentCode);
                                rebuildUniformControls(currentCode);
                            }
                        }
                    }, SIZE_DEBOUNCE_DELAY_MS);
                });
            };

            bindSizeField(widthField.input, widthWidget);
            bindSizeField(heightField.input, heightWidget);
            bindNumber(framesField.input, framesWidget);

            fpsField.input.type = "number";
            fpsField.input.addEventListener("input", () => {
                const value = parseFloat(fpsField.input.value);
                if (fpsWidget) fpsWidget.value = value;
                if (currentPreview && typeof currentPreview.setFPS === "function") {
                    currentPreview.setFPS(value);
                }
                this.setDirtyCanvas(true);
            });

            bindNumber(timeField.input, timeWidget);

            const originalOnRemoved = this.onRemoved;
            this.onRemoved = function () {
                clearTimeout(debounceTimer);
                clearTimeout(sizeDebounceTimer);
                clearInterval(syncPollingInterval);

                currentPreview?.stop?.();
                currentPreview = null;

                if (editorSection && editorSection.parentNode === document.body) {
                    document.body.removeChild(editorSection);
                }
                if (editorPlaceholder && editorPlaceholder.parentNode) {
                    editorPlaceholder.parentNode.removeChild(editorPlaceholder);
                }

                originalOnRemoved?.apply(this, arguments);
            };
        };
    }
});
