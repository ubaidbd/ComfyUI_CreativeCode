
export const UNIFORM_COMPONENT_KEYS = {
    vec2: ["x", "y"],
    vec3: ["x", "y", "z"],
    vec4: ["x", "y", "z", "w"],
};

// Value constraints to prevent numerical overflow
export const UNIFORM_LIMITS = {
    float: { min: -1e10, max: 1e10 },
    int: { min: -2147483648, max: 2147483647 },
    vec2: { components: 2, min: -1e10, max: 1e10 },
    vec3: { components: 3, min: -1e10, max: 1e10 },
    vec4: { components: 4, min: -1e10, max: 1e10 },
};

export function parseUniformDefault(type, expr) {
    const limits = UNIFORM_LIMITS[type];


    const clamp = (val) => {
        if (!Number.isFinite(val)) return 0;
        if (limits) {
            return Math.max(limits.min, Math.min(limits.max, val));
        }
        return val;
    };

    if (!expr) {
        if (type.startsWith("vec")) {
            const count = limits?.components || Math.min(Number(type.replace("vec", "")) || 2, 4);
            return new Array(count).fill(0);
        }
        if (type === "bool") return false;
        return 0;
    }

    if (type === "bool") {
        const normalized = expr.trim().toLowerCase();
        return normalized === "true" || normalized === "1";
    }

    const numRegex = /-?\d+\.?\d*(?:e[+-]?\d+)?/gi;
    const matches = expr.match(numRegex);

    if (type.startsWith("vec")) {
        const count = limits?.components || Math.min(Number(type.replace("vec", "")) || 2, 4);
        const values = matches ? matches.map((v) => clamp(parseFloat(v))) : [];
        if (values.length === 0) {
            return new Array(count).fill(0);
        }
        while (values.length < count) {
            values.push(values[values.length - 1] ?? 0);
        }
        return values.slice(0, count);
    }

    const value = matches ? clamp(parseFloat(matches[0])) : clamp(parseFloat(expr));
    return Number.isFinite(value) ? value : 0;
}

export function parseUniforms(code) {
    const glslPattern = /uniform\s+(float|int|bool|vec2|vec3|vec4)\s+([A-Za-z_]\w*)(?:\s*=\s*([^;]+))?;/gi;
    // Flexible parsing for @uniform annotations (supports optional types)
    const commentPattern = /@uniform\s+(float|int|bool|vec2|vec3|vec4|)\s*([A-Za-z_]\w*)(?:\s*=\s*([^;\n]+))?/gi;

    const uniformsMap = new Map();
    let match = null;

    // 1. Extract standard GLSL uniform declarations
    while ((match = glslPattern.exec(code)) !== null) {
        const [, type, name, rawDefault] = match;
        const defaultValue = parseUniformDefault(type, rawDefault || "");
        uniformsMap.set(name, { name, type, defaultValue, hasExplicitDefault: !!rawDefault });
    }

    // 2. Extract decorated uniform annotations (@uniform)
    while ((match = commentPattern.exec(code)) !== null) {
        let [, type, name, rawDefault] = match;
        type = type ? type.trim() : "";


        if (!type && uniformsMap.has(name)) {
            type = uniformsMap.get(name).type;
        }
        if (!type) type = "float";

        let defaultValue;
        // Support for hex color values in vec3 uniforms
        if (type === "vec3" && rawDefault && rawDefault.trim().startsWith("#")) {
            const hex = rawDefault.trim();
            const r = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
            const g = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
            const b = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
            defaultValue = [r, g, b];
        } else {
            defaultValue = parseUniformDefault(type, rawDefault || "");
        }

        if (!uniformsMap.has(name) || !uniformsMap.get(name).hasExplicitDefault) {
            uniformsMap.set(name, { name, type, defaultValue, hasExplicitDefault: !!rawDefault });
        }
    }

    return Array.from(uniformsMap.values());
}

export function createUniformControl(def, onChange) {
    const container = document.createElement("div");
    container.className = "st-uniform";

    const label = document.createElement("div");
    label.className = "st-uniform-label";
    label.textContent = `${def.name} (${def.type})`;
    container.appendChild(label);

    const inputs = [];
    const notify = () => {
        onChange?.(getValue());
    };

    const getValue = () => {
        if (def.type === "bool") {
            return inputs[0].checked;
        }
        if (def.type === "float" || def.type === "int") {
            return parseFloat(inputs[0].value) || 0;
        }

        if (inputs[0].type === "color") {
            const hex = inputs[0].value;
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            return [r, g, b];
        }
        return inputs.map((input) => parseFloat(input.value) || 0);
    };

    const setValue = (value) => {
        if (def.type === "bool") {
            inputs[0].checked = !!value;
            notify();
            return;
        }
        if (def.type === "float" || def.type === "int") {
            inputs[0].value = Number.isFinite(value) ? value : 0;
            notify();
            return;
        }

        if (inputs[0].type === "color" && Array.isArray(value)) {
            const toHex = (c) => {
                const h = Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16);
                return h.length === 1 ? "0" + h : h;
            };
            inputs[0].value = `#${toHex(value[0])}${toHex(value[1])}${toHex(value[2])}`;
            notify();
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((val, idx) => {
                if (inputs[idx]) inputs[idx].value = Number.isFinite(val) ? val : 0;
            });
            notify();
        }
    };

    // Automatic color picker heuristic: vec3 with 'color' in the identifier
    const isColor = def.type === "vec3" && def.name.toLowerCase().includes("color");

    if (def.type === "bool") {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!def.defaultValue;
        checkbox.addEventListener("change", notify);
        inputs.push(checkbox);
        container.appendChild(checkbox);
    } else if (isColor) {
        const row = document.createElement("div");
        row.className = "st-uniform-row";
        const cp = document.createElement("input");
        cp.type = "color";
        cp.style.height = "24px";
        cp.style.width = "100%";
        cp.style.cursor = "pointer";
        cp.style.border = "none";
        cp.style.background = "transparent";


        if (Array.isArray(def.defaultValue)) {
            const toHex = (c) => {
                const h = Math.round(c * 255).toString(16);
                return h.length === 1 ? "0" + h : h;
            };
            cp.value = `#${toHex(def.defaultValue[0])}${toHex(def.defaultValue[1])}${toHex(def.defaultValue[2])}`;
        } else {
            cp.value = "#ffffff";
        }

        cp.addEventListener("input", notify);
        inputs.push(cp);
        row.appendChild(cp);
        container.appendChild(row);
    } else if (def.type === "float" || def.type === "int") {
        const row = document.createElement("div");
        row.className = "st-uniform-row";
        const input = document.createElement("input");
        input.type = "number";
        input.step = def.type === "int" ? "1" : "0.01";
        input.value = Number.isFinite(def.defaultValue) ? def.defaultValue : 0;
        input.addEventListener("input", notify);
        inputs.push(input);
        row.appendChild(input);
        container.appendChild(row);
    } else {
        const keys = UNIFORM_COMPONENT_KEYS[def.type] || ["x", "y"];
        const row = document.createElement("div");
        row.className = "st-uniform-row";
        for (let i = 0; i < keys.length; i++) {
            const input = document.createElement("input");
            input.type = "number";
            input.step = "0.01";
            input.value = Number.isFinite(def.defaultValue?.[i]) ? def.defaultValue[i] : 0;
            input.title = keys[i];
            input.addEventListener("input", notify);
            inputs.push(input);
            row.appendChild(input);
        }
        container.appendChild(row);
    }

    notify();

    return {
        el: container,
        getValue,
        setValue,
    };
}
