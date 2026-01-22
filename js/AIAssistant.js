import {
    THEME_BG_DARK,
    THEME_TEXT_PRIMARY,
    THEME_TEXT_SECONDARY
} from "./constants.js";
import { makeAccordion } from "./utils.js";

export function createAIAssistantUI(container, callbacks) {
    const { getCurrentCode, onApplyCode } = callbacks;

    /** AI Assistant UI Section */
    const aiSection = document.createElement("div");
    aiSection.className = "st-section";
    aiSection.style.marginTop = "0px";

    const aiTitle = document.createElement("div");
    aiTitle.className = "st-title";
    aiTitle.innerHTML = `AI ASSISTANT`;

    const aiContent = document.createElement("div");
    aiContent.style.background = "rgba(0,0,0,0.2)";
    aiContent.style.padding = "10px";
    aiContent.style.borderTop = "1px solid rgba(255,255,255,0.05)";

    const aiHeaderRow = document.createElement("div");
    aiHeaderRow.style.display = "flex";
    aiHeaderRow.style.justifyContent = "space-between";
    aiHeaderRow.style.alignItems = "center";
    aiHeaderRow.style.marginBottom = "8px";

    const aiStatus = document.createElement("div");
    aiStatus.className = "st-library-status";
    aiStatus.style.fontFamily = "'JetBrains Mono', monospace";
    aiStatus.style.fontSize = "10px";
    aiStatus.style.color = "#666";
    aiStatus.textContent = "Checking Ollama...";
    aiHeaderRow.appendChild(aiStatus);

    // Layout for model selection and input controls
    const aiControls = document.createElement("div");
    aiControls.style.display = "flex";
    aiControls.style.gap = "6px";
    aiControls.style.marginBottom = "8px";

    const aiModelSelect = document.createElement("select");
    aiModelSelect.className = "st-input";
    aiModelSelect.style.width = "100px";
    aiModelSelect.style.flex = "0 0 auto";
    aiModelSelect.style.background = THEME_BG_DARK;
    aiModelSelect.style.border = "1px solid #333";
    aiModelSelect.style.color = THEME_TEXT_SECONDARY;
    aiModelSelect.style.fontSize = "10px";

    const aiPromptInput = document.createElement("input");
    aiPromptInput.className = "st-input";
    aiPromptInput.placeholder = "Describe changes or fix...";
    aiPromptInput.style.flex = "1";
    aiPromptInput.style.background = THEME_BG_DARK;
    aiPromptInput.style.border = "1px solid #333";
    aiPromptInput.style.color = THEME_TEXT_PRIMARY;
    aiPromptInput.style.transition = "all 0.2s";

    // Animation for highlighting the input field during automatic fixes
    const styleFlash = document.createElement("style");
    styleFlash.textContent = `@keyframes st-input-flash { 0% { border-color: #00bcd4; box-shadow: 0 0 15px rgba(0,188,212,0.5); } 100% { border-color: #333; box-shadow: none; } } .st-input-flash { animation: st-input-flash 0.8s ease-out; }`;
    document.head.appendChild(styleFlash);

    aiPromptInput.addEventListener("focus", () => aiPromptInput.style.borderColor = "#00bcd4");
    aiPromptInput.addEventListener("blur", () => aiPromptInput.style.borderColor = "#333");

    const aiGenBtn = document.createElement("button");
    aiGenBtn.textContent = "GENERATE";
    aiGenBtn.className = "st-btn";
    Object.assign(aiGenBtn.style, {
        background: "linear-gradient(135deg, #007cf0, #00dfd8)",
        border: "none",
        color: "#111",
        fontWeight: "800",
        fontSize: "10px",
        letterSpacing: "0.5px",
        padding: "0 12px",
        borderRadius: "2px",
        cursor: "pointer",
        boxShadow: "0 0 10px rgba(0, 223, 216, 0.2)"
    });
    aiGenBtn.onmouseover = () => { aiGenBtn.style.filter = "brightness(1.1)"; aiGenBtn.style.boxShadow = "0 0 15px rgba(0, 223, 216, 0.4)"; };
    aiGenBtn.onmouseout = () => { aiGenBtn.style.filter = "none"; aiGenBtn.style.boxShadow = "0 0 10px rgba(0, 223, 216, 0.2)"; };

    const aiApplyBtn = document.createElement("button");
    aiApplyBtn.className = "st-btn";
    aiApplyBtn.textContent = "✔ APPLY";
    aiApplyBtn.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
    aiApplyBtn.style.color = "#4caf50";
    aiApplyBtn.style.border = "1px solid #4caf50";
    aiApplyBtn.style.display = "none";
    aiApplyBtn.style.fontSize = "10px";
    aiApplyBtn.style.padding = "0 12px";

    const aiDiffBtn = document.createElement("button");
    aiDiffBtn.className = "st-btn";
    aiDiffBtn.textContent = "DIFF";
    aiDiffBtn.style.display = "none";
    aiDiffBtn.style.marginLeft = "4px";
    aiDiffBtn.style.fontSize = "10px";

    let pendingCode = "";

    aiControls.appendChild(aiModelSelect);
    aiControls.appendChild(aiPromptInput);
    aiControls.appendChild(aiGenBtn);
    aiControls.appendChild(aiDiffBtn);
    aiControls.appendChild(aiApplyBtn);

    // Quick-start template chips for common tasks
    const aiTemplates = document.createElement("div");
    aiTemplates.style.display = "flex";
    aiTemplates.style.gap = "6px";
    aiTemplates.style.marginTop = "8px";
    aiTemplates.style.flexWrap = "wrap";

    const templates = [
        { label: "✨ Glow", prompt: "Add post-processing bloom/glow effect to the shapes." },
        { label: "📺 CRT", prompt: "Add a retro CRT scanline and distortion effect." },
        { label: "🚀 Faster", prompt: "Optimize the loops and calculations for better performance." },
        { label: "🎨 Palette", prompt: "Change the color palette to something more vibrant and neon." },
        { label: "🎚️ Add Controls", prompt: "Add uniform float and vec3 parameters for key visual properties (speed, color, intensity) so they can be controlled via the Detected Uniforms panel." }
    ];

    templates.forEach(t => {
        const chip = document.createElement("div");
        chip.textContent = t.label;
        Object.assign(chip.style, {
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "2px 10px",
            fontSize: "9px",
            color: "#888",
            cursor: "pointer",
            transition: "all 0.2s"
        });
        chip.onmouseover = () => { chip.style.background = "rgba(255,255,255,0.1)"; chip.style.color = "#fff"; chip.style.borderColor = "#aaa"; };
        chip.onmouseout = () => { chip.style.background = "rgba(255,255,255,0.03)"; chip.style.color = "#888"; chip.style.borderColor = "rgba(255,255,255,0.1)"; };
        chip.onclick = () => {
            aiPromptInput.value = t.prompt;
            aiPromptInput.focus();
            aiPromptInput.style.borderColor = "#00bcd4";
        };
        aiTemplates.appendChild(chip);
    });

    aiContent.appendChild(aiHeaderRow);
    aiContent.appendChild(aiControls);
    aiContent.appendChild(aiTemplates);

    /** UI Initialization: Create the accordion for the AI section */
    const accordion = makeAccordion(aiSection, aiTitle, aiContent, false);

    container.appendChild(aiSection);

    /** Logic & API Interactions */
    const updateAIStatus = (text, isError = false) => {
        aiStatus.textContent = text;
        aiStatus.style.color = isError ? "#ff7272" : "#a7c7b7";
    };

    const fetchOllamaModels = async () => {
        try {
            const res = await fetch("/creativecode/ollama/models");
            if (!res.ok) throw new Error("Ollama offline");
            const data = await res.json();
            if (data.models && data.models.length > 0) {
                aiModelSelect.innerHTML = "";
                data.models.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m.name;
                    opt.textContent = m.name;
                    aiModelSelect.appendChild(opt);
                });

                // Restore previous session model or use sensible defaults
                const savedModel = localStorage.getItem("st_ollama_model");
                if (savedModel && data.models.some(m => m.name === savedModel)) {
                    aiModelSelect.value = savedModel;
                } else {
                    const defaultModel = data.models.find(m => m.name.includes("llama3") || m.name.includes("mistral"));
                    if (defaultModel) aiModelSelect.value = defaultModel.name;
                }

                updateAIStatus("Ready");
            } else {
                aiModelSelect.innerHTML = "<option>No models</option>";
                updateAIStatus("No models found", true);
            }
        } catch (e) {
            aiModelSelect.innerHTML = "<option>Offline</option>";
            updateAIStatus("Ollama offline", true);
        }
    };

    aiModelSelect.onchange = () => {
        localStorage.setItem("st_ollama_model", aiModelSelect.value);
    };

    let aiGenerationInProgress = false; // State guard to prevent parallel generation requests

    aiGenBtn.onclick = async () => {
        if (aiGenerationInProgress) return;
        aiGenerationInProgress = true;

        const model = aiModelSelect.value;
        const prompt = aiPromptInput.value.trim();
        const currentCode = getCurrentCode ? getCurrentCode() : "";

        console.log(`[CreativeCode AI] Sending to backend:`, {
            model,
            prompt,
            codeLength: currentCode.length,
            codePreview: currentCode.substring(0, 100) + "..."
        });

        // Determine generation mode based on prompt keywords
        let mode = "create";
        if (prompt.toLowerCase().startsWith("fix")) {
            mode = "fix";
        }

        updateAIStatus("Thinking...", false);
        aiGenBtn.disabled = true;
        aiPromptInput.disabled = true;
        aiApplyBtn.style.display = "none";

        try {
            const res = await fetch("/creativecode/ollama/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model,
                    prompt,
                    mode,
                    code: currentCode
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Generation failed");
            }

            const data = await res.json();

            console.log(`[CreativeCode AI] Received from backend:`, {
                hasCode: !!data.code,
                codeLength: data.code?.length || 0,
                codePreview: data.code?.substring(0, 100) + "..."
            });

            if (data.code) {
                pendingCode = data.code;
                aiApplyBtn.style.display = "inline-block";
                aiDiffBtn.style.display = "inline-block";
                updateAIStatus("Result ready!", false);
            } else {
                updateAIStatus("No code returned", true);
            }

        } catch (e) {
            updateAIStatus(`Error: ${e.message}`, true);
        } finally {
            aiGenBtn.disabled = false;
            aiPromptInput.disabled = false;
            aiGenerationInProgress = false;
        }
    };

    aiApplyBtn.onclick = () => {
        if (pendingCode) {
            if (onApplyCode) onApplyCode(pendingCode);
            pendingCode = "";
            aiApplyBtn.style.display = "none";
            aiDiffBtn.style.display = "none";
            updateAIStatus("Code updated.");
        }
    };

    const renderDiff = (oldText, newText) => {
        const overlay = document.createElement("div");
        overlay.className = "st-diff-overlay";

        const container = document.createElement("div");
        container.className = "st-diff-container";

        const createPane = (title, content, isNew) => {
            const pane = document.createElement("div");
            pane.className = "st-diff-pane";
            const header = document.createElement("div");
            header.className = "st-diff-header";
            header.textContent = title;
            const code = document.createElement("div");
            code.className = "st-diff-code";

            const oldLines = oldText.split("\n");
            const newLines = newText.split("\n");
            const lines = isNew ? newLines : oldLines;

            lines.forEach(line => {
                const span = document.createElement("span");
                span.textContent = line + "\n";
                if (isNew && !oldLines.includes(line)) span.className = "st-diff-line-add";
                if (!isNew && !newLines.includes(line)) span.className = "st-diff-line-rem";
                code.appendChild(span);
            });

            pane.appendChild(header);
            pane.appendChild(code);
            return pane;
        };

        container.appendChild(createPane("CURRENT CODE", oldText, false));
        container.appendChild(createPane("AI GENERATED (NEW)", newText, true));

        const footer = document.createElement("div");
        footer.className = "st-diff-footer";
        const closeBtn = document.createElement("button");
        closeBtn.className = "st-btn";
        closeBtn.textContent = "Close Preview";
        closeBtn.onclick = () => document.body.removeChild(overlay);

        const confirmBtn = document.createElement("button");
        confirmBtn.className = "st-btn";
        confirmBtn.textContent = "Apply This Change";
        confirmBtn.style.backgroundColor = "#2d5a3f";
        confirmBtn.onclick = () => {
            aiApplyBtn.onclick();
            document.body.removeChild(overlay);
        };

        footer.appendChild(closeBtn);
        footer.appendChild(confirmBtn);
        overlay.appendChild(container);
        overlay.appendChild(footer);
        document.body.appendChild(overlay);
    };

    aiDiffBtn.onclick = () => {
        if (pendingCode) {
            const currentCode = getCurrentCode ? getCurrentCode() : "";
            renderDiff(currentCode, pendingCode);
        }
    };

    /** Model population on initialization */
    setTimeout(fetchOllamaModels, 1000);

    /** 
     * Triggers an AI-assisted fix for a specific error 
     * @param {string} errorMsg - The error message to resolve
     * @param {number|string} line - The line number where the error occurred
     */
    const triggerAiFix = (errorMsg, line) => {
        if (!accordion.isOpen()) {
            accordion.toggle();
        }

        aiPromptInput.value = `Fix this error on line ${line}: ${errorMsg}`;

        setTimeout(() => {
            aiPromptInput.scrollIntoView({ behavior: "smooth", block: "center" });
            aiPromptInput.focus();

            aiPromptInput.classList.remove("st-input-flash");
            void aiPromptInput.offsetWidth;
            aiPromptInput.classList.add("st-input-flash");

            aiGenBtn.click();
        }, 300);
    };

    return {
        triggerFix: triggerAiFix
    };
}
