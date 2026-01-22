import { makeAccordion } from "./utils.js";

export function createShaderLibraryUI(container, callbacks) {
    const { onCodeLoaded, getCurrentCode } = callbacks;

    /** Shader Library UI Section */
    const librarySection = document.createElement("div");
    librarySection.className = "st-section";

    const libraryTitle = document.createElement("div");
    libraryTitle.className = "st-title";
    libraryTitle.textContent = "Shader Library";

    const libraryContent = document.createElement("div");

    const searchWrapper = document.createElement("div");
    searchWrapper.className = "st-search-wrapper";

    const searchInput = document.createElement("input");
    searchInput.className = "st-search-input";
    searchInput.placeholder = "Search library (32 items)...";
    searchWrapper.appendChild(searchInput);

    const glslCatTitle = document.createElement("div");
    glslCatTitle.className = "st-cat-title";
    glslCatTitle.textContent = "GLSL Shaders";
    glslCatTitle.style.display = "none";

    const glslGallery = document.createElement("div");
    glslGallery.className = "st-gallery";

    const p5CatTitle = document.createElement("div");
    p5CatTitle.className = "st-cat-title";
    p5CatTitle.textContent = "p5.js Sketches";
    p5CatTitle.style.display = "none";

    const p5Gallery = document.createElement("div");
    p5Gallery.className = "st-gallery";

    const libraryControls = document.createElement("div");
    libraryControls.className = "st-library-controls";
    libraryControls.style.marginTop = "10px";
    libraryControls.style.display = "flex";
    libraryControls.style.gap = "4px";
    libraryControls.style.borderTop = "1px solid rgba(255,255,255,0.1)";
    libraryControls.style.paddingTop = "8px";
    libraryControls.style.alignItems = "center";

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "st-btn";
    refreshBtn.textContent = "🔄";
    refreshBtn.title = "Refresh Library";
    refreshBtn.style.width = "24px";
    refreshBtn.style.height = "24px";
    refreshBtn.style.padding = "0";
    refreshBtn.style.fontSize = "12px";
    refreshBtn.style.opacity = "0.7";

    const libraryNameInput = document.createElement("input");
    libraryNameInput.className = "st-input";
    libraryNameInput.placeholder = "Save preset as...";
    libraryNameInput.style.flex = "1";
    libraryNameInput.style.minWidth = "0";
    libraryNameInput.style.fontSize = "11px";
    libraryNameInput.style.background = "rgba(0,0,0,0.2)";
    libraryNameInput.style.border = "none";
    libraryNameInput.style.borderRadius = "2px";
    libraryNameInput.style.height = "24px";

    const librarySaveBtn = document.createElement("button");
    librarySaveBtn.className = "st-btn";
    librarySaveBtn.textContent = "\uD83D\uDCBE";
    librarySaveBtn.title = "Save to Library";
    librarySaveBtn.style.width = "24px";
    librarySaveBtn.style.height = "24px";
    librarySaveBtn.style.padding = "0";
    librarySaveBtn.style.fontSize = "12px";
    librarySaveBtn.style.opacity = "0.7";

    libraryControls.appendChild(refreshBtn);
    libraryControls.appendChild(libraryNameInput);
    libraryControls.appendChild(librarySaveBtn);

    const libraryStatus = document.createElement("div");
    libraryStatus.className = "st-library-status";
    libraryStatus.textContent = "";
    libraryStatus.style.fontSize = "9px";
    libraryStatus.style.marginTop = "2px";
    libraryStatus.style.textAlign = "right";
    libraryStatus.style.opacity = "0.7";
    libraryStatus.style.minHeight = "12px";

    libraryContent.appendChild(searchWrapper);
    libraryContent.appendChild(glslCatTitle);
    libraryContent.appendChild(glslGallery);
    libraryContent.appendChild(p5CatTitle);
    libraryContent.appendChild(p5Gallery);
    libraryContent.appendChild(libraryControls);
    libraryContent.appendChild(libraryStatus);


    makeAccordion(librarySection, libraryTitle, libraryContent, false);

    container.appendChild(librarySection);

    /** Logic & API Interactions */
    const updateLibraryStatus = (text, isError = false) => {
        libraryStatus.textContent = text;
        libraryStatus.style.color = isError ? "#ff7272" : "#a7c7b7";
    };

    let activeLibraryData = [];

    const loadLibraryShader = async (shaderName) => {
        if (!shaderName) return;
        try {
            const res = await fetch(`/creativecode/shaders/${shaderName}`);
            const data = await res.json();
            if (data.code) {
                if (onCodeLoaded) onCodeLoaded(data.code);
                updateLibraryStatus(`Loaded "${shaderName}".`);
            }
        } catch (err) {
            updateLibraryStatus("Load failed.", true);
        }
    };

    const renderLibrary = (filter = "") => {
        glslGallery.innerHTML = "";
        p5Gallery.innerHTML = "";

        const filtered = activeLibraryData.filter(s =>
            s.name.toLowerCase().includes(filter.toLowerCase())
        );

        filtered.forEach(shader => {
            const chip = document.createElement("div");
            chip.className = "st-chip";

            let isP5 = false;
            if (shader.category === "p5") isP5 = true;
            else if (shader.category === "glsl") isP5 = false;
            else {
                // Fallback heuristic if uncategorized
                isP5 = shader.name.startsWith("p5_") || shader.filename.endsWith(".js") || shader.name.includes("p5");
            }

            chip.classList.add(isP5 ? "st-chip-p5" : "st-chip-glsl");

            if (shader.uses_channels) {
                chip.classList.add("st-chip-channels");
            }

            const icon = document.createElement("span");
            icon.className = "st-chip-icon";
            icon.textContent = isP5 ? "JS" : "GL";

            const label = document.createElement("span");
            label.textContent = shader.name.replace("glsl_", "").replace("p5_", "");

            chip.appendChild(icon);
            chip.appendChild(label);

            if (shader.uses_channels) {
                const texIcon = document.createElement("span");
                texIcon.style.marginLeft = "4px";
                texIcon.style.fontSize = "9px";
                texIcon.title = "Uses iChannel textures";
                texIcon.textContent = "🖼️";
                chip.appendChild(texIcon);
            }


            if (shader.has_uniforms) {
                chip.classList.add("st-chip-uniforms");
                const uniIcon = document.createElement("span");
                uniIcon.style.marginLeft = "4px";
                uniIcon.style.fontSize = "9px";
                uniIcon.title = "Has interactive parameters";
                uniIcon.textContent = "🎚️";
                chip.appendChild(uniIcon);
            }

            chip.onclick = () => {

                document.querySelectorAll(".st-chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                loadLibraryShader(shader.name);
            };

            if (isP5) p5Gallery.appendChild(chip);
            else glslGallery.appendChild(chip);
        });


        glslCatTitle.style.display = glslGallery.children.length ? "flex" : "none";
        p5CatTitle.style.display = p5Gallery.children.length ? "flex" : "none";
    };

    const refreshLibrary = async () => {
        try {
            const res = await fetch("/creativecode/shaders");
            const payload = await res.json();
            if (payload.shaders && Array.isArray(payload.shaders)) {
                activeLibraryData = payload.shaders;
                renderLibrary(searchInput.value);
                updateLibraryStatus(`Library updated (${activeLibraryData.length}).`);
            }
        } catch (err) {
            updateLibraryStatus("Library sync failed.", true);
        }
    };

    refreshBtn.onclick = () => refreshLibrary();

    // Debounced search to optimize filtering performance
    let searchDebounceTimer = null;
    searchInput.oninput = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            renderLibrary(searchInput.value);
        }, 200);
    };

    const saveLibraryShader = async () => {
        const name = libraryNameInput.value.trim();
        if (!name) {
            updateLibraryStatus("Enter a shader name first.", true);
            return;
        }


        const sanitizedAssumption = name.replace(/[^a-zA-Z0-9\-_]/g, "_");
        const exists = activeLibraryData.some(s => s.name === name || s.name === sanitizedAssumption);

        if (exists) {
            if (!confirm(`Shader "${name}" may already exist. Overwrite?`)) {
                updateLibraryStatus("Save cancelled.");
                return;
            }
        }

        const currentCode = getCurrentCode ? getCurrentCode() : "";

        try {
            const response = await fetch("/creativecode/shaders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, code: currentCode }),
            });
            const payload = await response.json();
            if (payload.status === "ok") {
                updateLibraryStatus(`Saved "${name}".`);

                refreshLibrary();
            } else {
                updateLibraryStatus(payload.error || "Save failed.", true);
            }
        } catch (err) {
            updateLibraryStatus("Save failed.", true);
        }
    };

    librarySaveBtn.onclick = () => saveLibraryShader();


    refreshLibrary();

    return {
        loadShader: loadLibraryShader,
        refresh: refreshLibrary
    };
}
