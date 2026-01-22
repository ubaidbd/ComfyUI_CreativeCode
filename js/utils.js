

const DEBUG_MODE = false;
export const logger = {
    debug: (...args) => DEBUG_MODE && console.log("[CreativeCode]", ...args),
    info: (...args) => console.info("[CreativeCode]", ...args),
    warn: (...args) => console.warn("[CreativeCode]", ...args),
    error: (...args) => console.error("[CreativeCode]", ...args),
};

export function hideWidget(widget) {
    if (!widget) return;
    widget.hidden = true;
    widget.type = "hidden";
    widget.computeSize = () => [0, 0];
    if (widget.inputEl) {
        widget.inputEl.style.display = "none";
        widget.inputEl.style.height = "0px";
        widget.inputEl.style.margin = "0px";
        widget.inputEl.style.padding = "0px";
    }
}

export function detectCodeType(code) {
    if (!code) return "glsl";
    // Aggressively remove comments for detection to avoid @uniform issues
    const normalize = code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();

    const hasFunctionSetup = /\bfunction\s+setup\b/.test(normalize) || /\bsetup\s*=\s*function\b/.test(normalize);
    const hasFunctionDraw = /\bfunction\s+draw\b/.test(normalize) || /\bdraw\s*=\s*function\b/.test(normalize);
    const hasVoidSetup = /\bvoid\s+setup\s*\(/.test(normalize);
    const hasVoidDraw = /\bvoid\s+draw\s*\(/.test(normalize);

    if (hasFunctionSetup || hasFunctionDraw || hasVoidSetup || hasVoidDraw) {
        return "p5";
    }

    const hasArrowDraw = /\bdraw\s*=\s*(?:async\s*)?(?:\([^\)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(normalize);
    const hasArrowSetup = /\bsetup\s*=\s*(?:async\s*)?(?:\([^\)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(normalize);
    const usesNewP5 = /\bnew\s+p5\s*\(/.test(normalize);
    const hasCreateCanvas = /\bcreateCanvas\s*\(/.test(normalize);

    if (hasArrowDraw || hasArrowSetup || usesNewP5 || hasCreateCanvas) {
        return "p5";
    }

    const isGLSL = /\bvoid\s+mainimage\s*\(/.test(normalize) ||
        /#version\s+\d+/.test(normalize) ||
        // Check for uniform but NOT @uniform (which should be stripped anyway)
        /\buniform\s+(?:float|int|vec|sampler)\b/.test(normalize);

    if (isGLSL) {
        return "glsl";
    }

    const hasP5Functions = /\b(background|stroke|fill|noStroke|noFill|ellipse|rect|circle|line|point|triangle)\s*\(/.test(normalize);
    if (hasP5Functions) {
        return "p5";
    }

    return "glsl";
}

export function ensureStyle() {
    const styleId = "shader-toy-ui-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
        .st-diff-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 10000; display: flex; flex-direction: column; padding: 40px; box-sizing: border-box; font-family: sans-serif; }
        .st-diff-container { display: flex; gap: 10px; flex: 1; overflow: hidden; background: #000; border-radius: 8px; border: 1px solid #444; }
        .st-diff-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid #222; }
        .st-diff-header { padding: 12px; background: #111; border-bottom: 1px solid #333; font-size: 11px; letter-spacing: 0.5px; font-weight: 700; color: #666; text-transform: uppercase; }
        .st-diff-code { flex: 1; overflow-y: auto; padding: 15px; font-family: monospace; font-size: 11px; white-space: pre; line-height: 1.6; color: #bbb; }
        .st-diff-line-add { background: rgba(46, 160, 67, 0.25); border-left: 3px solid #2ea043; display: block; margin: 0 -15px; padding: 0 15px; color: #aff5b4; }
        .st-diff-line-rem { background: rgba(248, 81, 73, 0.25); border-left: 3px solid #f85149; display: block; margin: 0 -15px; padding: 0 15px; color: #ffa198; }
        .st-diff-footer { padding: 20px 0; display: flex; justify-content: flex-end; gap: 12px; }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

        .st-node {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 8px;
            box-sizing: border-box;
            background: #141414;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.07);
            font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
            color: #e0e0e0;
            overflow-y: auto;
            overflow-x: hidden;
            min-width: 0;
        }
        .st-section {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 6px;
            background: rgba(255,255,255,0.02);
            padding: 4px 6px;
            box-shadow: none;
            overflow: hidden;
            min-width: 0;
        }
        .st-title {
            font-size: 10px;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #9aa4ad;
            margin-bottom: 4px;
        }
        .st-editor {
            width: 100%;
            min-height: 280px;
            height: 280px;
            background: #1a1a2e;
            border: 1px solid #2a2a4e;
            border-radius: 4px;
            overflow: hidden;
            box-sizing: border-box;
            position: relative;
        }
        .st-editor-fallback {
            width: 100%;
            height: 100%;
            resize: none;
            background: #0d0f11;
            color: #e6e6e6;
            border: none;
            padding: 8px;
            font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
            font-size: 12px;
            line-height: 1.4;
            box-sizing: border-box;
        }
        .st-error-wrapper {
            position: relative;
            width: 100%;
            display: none;
            margin-top: 8px;
        }
        .st-fix-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(10, 10, 15, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(74, 158, 255, 0.3);
            color: #4a9eff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .st-fix-btn:hover {
            background: rgba(74, 158, 255, 0.15);
            border-color: #4a9eff;
            color: #fff;
            box-shadow: 0 0 15px rgba(74, 158, 255, 0.4), 0 0 30px rgba(74, 158, 255, 0.2);
            transform: translateY(-1px);
        }
        .st-fix-btn:active {
            transform: translateY(0);
            box-shadow: 0 0 5px rgba(74, 158, 255, 0.4);
        }
        @keyframes input-flash {
            0% { background-color: rgba(74, 158, 255, 0.0); box-shadow: 0 0 0 0 rgba(74, 158, 255, 0); }
            15% { background-color: rgba(74, 158, 255, 0.2); box-shadow: 0 0 10px 2px rgba(74, 158, 255, 0.3); border-color: #4a9eff; }
            100% { background-color: rgba(74, 158, 255, 0.0); box-shadow: 0 0 0 0 rgba(74, 158, 255, 0); }
        }
        .st-input-flash {
            animation: input-flash 1s ease-out forwards;
        }
        .st-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .st-row + .st-row {
            margin-top: 8px;
        }
        .st-btn {
            background: #1e1f22;
            color: #e6e6e6;
            border: 1px solid #2b2d31;
            border-radius: 4px;
            padding: 4px 10px;
            font-size: 11px;
            cursor: pointer;
            flex-shrink: 0;
        }
        .st-btn:hover {
            border-color: #4dd5b4;
            color: #4dd5b4;
        }
        .st-preview {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            flex-wrap: wrap;
        }
        .st-canvas {
            position: relative;
            width: 100%;
            background: #000;
            border: 1px solid #222;
            border-radius: 4px;
            overflow: hidden !important;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .st-canvas canvas.st-gl-canvas {
            display: block;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .st-p5-container {
            display: none;
            position: absolute;
            inset: 0;
            overflow: hidden !important;
            contain: layout style paint;
            z-index: 5;
        }
        .st-p5-container canvas {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
            z-index: 10;
            margin: 0 !important;
            padding: 0 !important;
            object-fit: contain !important;
        }
        .st-error {
            width: 100%;
            min-height: 40px;
            max-height: 120px;
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-word;
            overflow-y: auto;
            color: #ff7b6b;
            background: #120a0a;
            border: 1px solid rgba(255,120,120,0.2);
            border-radius: 4px;
            padding: 6px;
            box-sizing: border-box;
            display: none;
        }
        .st-error:not(:empty) {
            display: block;
        }
        .st-settings-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
        }
        .st-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .st-label {
            font-size: 10px;
            color: #9aa4ad;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .st-input {
            width: 100%;
            height: 26px;
            background: #101114;
            border: 1px solid #24262b;
            border-radius: 4px;
            color: #f0f0f0;
            padding: 0 6px;
            font-size: 12px;
            box-sizing: border-box;
        }
        .st-library { display: flex; flex-direction: column; gap: 12px; margin-bottom: 4px; }
        .st-search-wrapper { position: relative; width: 100%; }
        .st-search-input { width: 100%; height: 32px; background: rgba(0,0,0,0.3); border: 1px solid #334; border-radius: 16px; color: #fff; padding: 0 35px 0 12px; font-size: 11px; outline: none; transition: all 0.2s; }
        .st-search-input:focus { border-color: #557; background: rgba(255,255,255,0.05); box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .st-cat-title { font-size: 9px; font-weight: 800; color: #556; text-transform: uppercase; letter-spacing: 1.5px; margin: 8px 0 4px 4px; display: flex; align-items: center; gap: 6px; }
        .st-cat-title::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.03); }
        .st-gallery { display: flex; flex-wrap: wrap; gap: 6px; max-height: 300px; overflow-y: auto; padding: 4px; scrollbar-width: thin; align-content: flex-start; }
        .st-chip { padding: 4px 10px; background: #1a1a1b; border: 1px solid #333; border-radius: 4px; cursor: pointer; font-size: 11px; color: #9aa4ad; transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); user-select: none; display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
        .st-chip:hover { transform: translateY(-1px); border-color: #555; background: #222; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        .st-chip.active { background: rgba(0, 255, 200, 0.1); border-color: #00ffc8; color: #00ffc8; }
        .st-chip-glsl { border-left: 3px solid #8e44ad; }
        .st-chip-p5 { border-left: 3px solid #e91e63; }
        .st-chip-channels { background: rgba(255, 165, 0, 0.1); border-color: rgba(255, 165, 0, 0.4); }
        .st-chip-channels:hover { border-color: #ffa500; }
        .st-chip-uniforms { background: rgba(0, 150, 255, 0.1); border-color: rgba(0, 150, 255, 0.4); }
        .st-chip-uniforms:hover { border-color: #0096ff; }
        .st-chip-icon { font-size: 8px; opacity: 0.6; }
        .st-library-status {
            font-size: 10px;
            color: #a7c7b7;
        }
        .st-uniform-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 8px;
        }
        .st-uniform {
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 4px;
            padding: 6px;
            background: rgba(255,255,255,0.02);
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .st-uniform-label {
            font-size: 10px;
            color: #9aa4ad;
            letter-spacing: 0.5px;
        }
        .st-uniform-row {
            display: flex;
            gap: 4px;
        }
        .st-uniform-row input {
            flex: 1;
            font-size: 11px;
            height: 24px;
            padding: 0 6px;
        }
        .st-uniform-placeholder {
            font-size: 11px;
            color: #7a7a7a;
            font-style: italic;
        }
        .st-stats {
            margin-top: 0px; /* Reduced from 8px to remove gap */
            display: flex;
            flex-direction: column;
            font-size: 10px;
            color: #cfd7df;
            min-width: 0;
            overflow: hidden;
            /* Only show padding/margin if content exists - handled via empty check or just keeping it collapsing */
        }
        .st-stats-overlay {
            position: absolute;
            bottom: 6px;
            left: 6px;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(4px);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.8);
            pointer-events: none;
            z-index: 100;
            font-family: "JetBrains Mono", monospace;
            letter-spacing: 0.3px;
        }
        .st-stats-line {
            font-weight: 600;
            color: #ececec;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .st-warning-line {
            color: #ff9a70;
            /* min-height removed to prevent empty space */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding: 0 4px; /* Slight padding for when text appears */
        }
        .st-version-note {
            font-size: 9px;
            color: #7a8a9a;
            font-style: italic;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 6px;
            padding: 4px 6px;
            background: rgba(0,0,0,0.2);
            border-radius: 3px;
            border-left: 2px solid #4a6a8a;
        }
    `;
    document.head.appendChild(style);
}

export function makeAccordion(section, titleEl, contentEl, defaultOpen = false, callback = null) {
    const arrow = document.createElement("span");
    arrow.style.marginRight = "8px";
    arrow.style.fontSize = "10px";
    arrow.style.display = "inline-block";
    arrow.textContent = defaultOpen ? "▼" : "▶";

    titleEl.insertBefore(arrow, titleEl.firstChild);
    titleEl.style.cursor = "pointer";
    titleEl.style.userSelect = "none";
    titleEl.title = "Click to toggle";

    contentEl.style.display = defaultOpen ? "block" : "none";

    titleEl.onclick = () => {
        const isClosed = contentEl.style.display === "none";
        contentEl.style.display = isClosed ? "block" : "none";
        arrow.textContent = isClosed ? "▼" : "▶";
        if (callback) setTimeout(callback, 50);
    };

    section.appendChild(titleEl);
    section.appendChild(contentEl);

    return {
        toggle: () => titleEl.click(),
        isOpen: () => contentEl.style.display !== "none"
    }
}
