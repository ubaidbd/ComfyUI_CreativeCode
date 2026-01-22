import { EDITOR_FONT_SIZE, EDITOR_FONT_FAMILY } from "./constants.js";

export const GLSL_LANGUAGE_DEF = {
    keywords: [
        'void', 'bool', 'int', 'uint', 'float', 'double',
        'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4',
        'uvec2', 'uvec3', 'uvec4', 'bvec2', 'bvec3', 'bvec4',
        'mat2', 'mat3', 'mat4', 'mat2x2', 'mat2x3', 'mat2x4',
        'mat3x2', 'mat3x3', 'mat3x4', 'mat4x2', 'mat4x3', 'mat4x4',
        'sampler2D', 'sampler3D', 'samplerCube',
        'struct', 'uniform', 'in', 'out', 'inout',
        'const', 'attribute', 'varying', 'precision',
        'highp', 'mediump', 'lowp',
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
        'break', 'continue', 'return', 'discard',
        'true', 'false'
    ],

    builtinFunctions: [
        'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp',
        'mix', 'step', 'smoothstep', 'sqrt', 'inversesqrt', 'pow', 'exp', 'log',
        'exp2', 'log2', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
        'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
        'length', 'distance', 'dot', 'cross', 'normalize', 'reflect', 'refract',
        'faceforward', 'matrixCompMult', 'outerProduct', 'transpose', 'determinant', 'inverse',
        'texture', 'texture2D', 'texture3D', 'textureCube', 'textureSize', 'texelFetch',
        'dFdx', 'dFdy', 'fwidth',
        'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual', 'equal', 'notEqual',
        'any', 'all', 'not'
    ],

    shadertoyUniforms: [
        { name: 'iResolution', type: 'vec3', desc: 'Viewport resolution (width, height, pixel ratio)' },
        { name: 'iTime', type: 'float', desc: 'Playback time in seconds' },
        { name: 'iTimeDelta', type: 'float', desc: 'Time between frames' },
        { name: 'iFrame', type: 'int', desc: 'Current frame number' },
        { name: 'iMouse', type: 'vec4', desc: 'Mouse position (xy: current, zw: click)' },
        { name: 'iChannel0', type: 'sampler2D', desc: 'Input texture channel 0' },
        { name: 'iChannel1', type: 'sampler2D', desc: 'Input texture channel 1' },
        { name: 'iChannel2', type: 'sampler2D', desc: 'Input texture channel 2' },
        { name: 'iChannel3', type: 'sampler2D', desc: 'Input texture channel 3' },
        { name: 'iChannelResolution', type: 'vec3[4]', desc: 'Resolution of each channel' },
        { name: 'iDate', type: 'vec4', desc: 'Current date (year, month, day, time)' }
    ]
};

export const P5_ADDITIONS = {
    functions: [
        'setup', 'draw', 'preload', 'mousePressed', 'mouseReleased', 'mouseMoved',
        'keyPressed', 'keyReleased', 'windowResized',
        'createCanvas', 'resizeCanvas', 'background', 'fill', 'stroke', 'noFill', 'noStroke',
        'ellipse', 'rect', 'circle', 'line', 'point', 'triangle', 'quad', 'arc',
        'beginShape', 'endShape', 'vertex', 'curveVertex', 'bezierVertex',
        'translate', 'rotate', 'scale', 'push', 'pop', 'resetMatrix',
        'color', 'lerpColor', 'brightness', 'saturation', 'hue', 'red', 'green', 'blue', 'alpha',
        'loadImage', 'image', 'tint', 'noTint', 'imageMode',
        'text', 'textSize', 'textAlign', 'textFont', 'loadFont',
        'random', 'noise', 'noiseSeed', 'randomSeed', 'randomGaussian',
        'map', 'constrain', 'lerp', 'norm', 'dist', 'mag',
        'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
        'abs', 'ceil', 'floor', 'round', 'sqrt', 'pow', 'exp', 'log', 'sq',
        'frameRate', 'frameCount', 'deltaTime', 'millis',
        'width', 'height', 'mouseX', 'mouseY', 'pmouseX', 'pmouseY',
        'keyCode', 'key', 'keyIsPressed', 'mouseIsPressed',
        'PI', 'TWO_PI', 'HALF_PI', 'QUARTER_PI', 'TAU',
        'CENTER', 'CORNER', 'CORNERS', 'RADIUS',
        'RGB', 'HSB', 'HSL'
    ],
    constants: [
        'PI', 'TWO_PI', 'HALF_PI', 'QUARTER_PI', 'TAU', 'DEGREES', 'RADIANS',
        'CENTER', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'BASELINE',
        'CORNER', 'CORNERS', 'RADIUS', 'CLOSE',
        'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP'
    ]
};

let monacoLoaded = false;
let monacoLoadPromise = null;

export function loadMonaco() {
    if (monacoLoaded) return Promise.resolve(window.monaco);
    if (monacoLoadPromise) return monacoLoadPromise;

    monacoLoadPromise = new Promise((resolve, reject) => {
        const loaderScript = document.createElement('script');
        loaderScript.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
        loaderScript.onload = () => {
            window.require.config({
                paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
            });

            window.require(['vs/editor/editor.main'], () => {
                monacoLoaded = true;
                registerGLSLLanguage();
                registerAutoComplete();
                resolve(window.monaco);
            });
        };
        loaderScript.onerror = reject;
        document.head.appendChild(loaderScript);
    });

    return monacoLoadPromise;
}

function registerGLSLLanguage() {
    const monaco = window.monaco;

    // Registry initialization
    monaco.languages.register({ id: 'glsl' });

    monaco.languages.setMonarchTokensProvider('glsl', {
        keywords: GLSL_LANGUAGE_DEF.keywords,
        builtins: GLSL_LANGUAGE_DEF.builtinFunctions,

        tokenizer: {
            root: [
                [/\/\/.*$/, 'comment'],
                [/\/\*/, 'comment', '@comment'],

                [/#\w+/, 'keyword.preprocessor'],

                [/\d+/, 'number'],

                [/"/, 'string', '@string'],

                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@builtins': 'keyword.function',
                        '@default': 'identifier'
                    }
                }],

                [/[+\-*\/=<>!&|^~?:%]+/, 'operator']
            ],

            comment: [
                [/[^\/*]+/, 'comment'],
                [/\*\//, 'comment', '@pop'],
                [/[\/*]/, 'comment']
            ],

            string: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, 'string', '@pop']
            ]
        }
    });

    monaco.editor.defineTheme('glsl-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'identifier', foreground: 'abb2bf' }
        ],
        colors: {
            'editor.background': '#0d0f11',
            'editor.foreground': '#e6e6e6',
            'editorLineNumber.foreground': '#4b5263',
            'editorLineNumber.activeForeground': '#abb2bf',
            'editor.lineHighlightBackground': '#1e1f22',
            'editorCursor.foreground': '#528bff',
            'editor.selectionBackground': '#264f78',
            'editorError.foreground': '#e06c75',
            'editorWarning.foreground': '#e5c07b',
            'editorWidget.background': '#1e1f22',
            'editorWidget.border': '#2b2d31'
        }
    });
}

function registerAutoComplete() {
    const monaco = window.monaco;

    monaco.languages.registerCompletionItemProvider('glsl', {
        provideCompletionItems: (model, position) => {
            const suggestions = [];

            GLSL_LANGUAGE_DEF.shadertoyUniforms.forEach(u => {
                suggestions.push({
                    label: u.name,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    detail: `${u.type} - ${u.desc}`,
                    insertText: u.name,
                    documentation: u.desc
                });
            });

            GLSL_LANGUAGE_DEF.builtinFunctions.forEach(fn => {
                suggestions.push({
                    label: fn,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: fn + '($0)',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                });
            });

            GLSL_LANGUAGE_DEF.keywords.forEach(kw => {
                suggestions.push({
                    label: kw,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: kw
                });
            });

            suggestions.push({
                label: 'mainImage',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'ShaderToy main function',
                insertText: 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n\tvec2 uv = fragCoord / iResolution.xy;\n\t$0\n\tfragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            suggestions.push({
                label: 'sdf_circle',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'SDF Circle function',
                insertText: 'float sdCircle(vec2 p, float r) {\n\treturn length(p) - r;\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            suggestions.push({
                label: 'sdf_box',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'SDF Box function',
                insertText: 'float sdBox(vec2 p, vec2 b) {\n\tvec2 d = abs(p) - b;\n\treturn length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            suggestions.push({
                label: 'rot',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: '2D Rotation Matrix',
                insertText: 'mat2 rot(float a) {\n\tfloat s = sin(a), c = cos(a);\n\treturn mat2(c, -s, s, c);\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            suggestions.push({
                label: 'smin',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'Smooth Minimum (Polynomial)',
                insertText: 'float smin(float a, float b, float k) {\n\tfloat h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);\n\treturn mix(b, a, h) - k * h * (1.0 - h);\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            suggestions.push({
                label: 'pal',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'Cosine Gradient Palette',
                insertText: 'vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {\n\treturn a + b * cos(6.28318 * (c * t + d));\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            return { suggestions };
        }
    });

    monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
            const suggestions = [];

            P5_ADDITIONS.functions.forEach(fn => {
                suggestions.push({
                    label: fn,
                    kind: monaco.languages.CompletionItemKind.Function,
                    detail: 'P5.js',
                    insertText: fn
                });
            });

            P5_ADDITIONS.constants.forEach(c => {
                suggestions.push({
                    label: c,
                    kind: monaco.languages.CompletionItemKind.Constant,
                    detail: 'P5.js constant',
                    insertText: c
                });
            });

            suggestions.push({
                label: 'setup_draw',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'P5.js template',
                insertText: 'function setup() {\n\tcreateCanvas(${1:400}, ${2:400});\n}\n\nfunction draw() {\n\tbackground(${3:0});\n\t$0\n}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            suggestions.push({
                label: '@uniform',
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'Uniform annotation',
                insertText: '// @uniform ${1:float} ${2:name} = ${3:1.0}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            });

            return { suggestions };
        }
    });
}

export async function createMonacoEditor(container, initialValue = '', language = 'glsl', onChange = null) {
    const monaco = await loadMonaco();

    const editor = monaco.editor.create(container, {
        value: initialValue,
        language: language,
        theme: 'glsl-dark',
        fontSize: EDITOR_FONT_SIZE,
        fontFamily: EDITOR_FONT_FAMILY,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        scrollBeyondLastLine: true,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'off',
        folding: false,
        renderLineHighlight: 'line',
        scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
        },
        padding: { top: 12, bottom: 30 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        glyphMargin: false,
        lineDecorationsWidth: 4
    });

    if (onChange) {
        editor.onDidChangeModelContent(() => {
            onChange(editor.getValue());
        });
    }

    let errorDecorations = [];

    const wrapper = {
        editor,
        monaco,

        getValue() {
            return editor.getValue();
        },

        setValue(value) {
            editor.setValue(value);
        },

        setLanguage(lang) {
            monaco.editor.setModelLanguage(editor.getModel(), lang);
        },

        setErrors(errors) {
            const model = editor.getModel();
            if (!model) return;

            monaco.editor.setModelMarkers(model, 'glsl-errors', []);
            errorDecorations = editor.deltaDecorations(errorDecorations, []);

            if (!errors || errors.length === 0) return;

            const lineCount = model.getLineCount();

            const validErrors = errors.filter(err => err.line >= 1 && err.line <= lineCount);

            const markers = validErrors.map(err => ({
                startLineNumber: err.line,
                startColumn: 1,
                endLineNumber: err.line,
                endColumn: model.getLineMaxColumn(err.line),
                message: err.message,
                severity: err.severity === 'warning'
                    ? monaco.MarkerSeverity.Warning
                    : monaco.MarkerSeverity.Error
            }));

            monaco.editor.setModelMarkers(model, 'glsl-errors', markers);

            const decorations = validErrors.map(err => ({
                range: new monaco.Range(err.line, 1, err.line, 1),
                options: {
                    isWholeLine: true,
                    className: err.severity === 'warning' ? 'warning-line' : 'error-line',
                    glyphMarginClassName: err.severity === 'warning' ? 'warning-glyph' : 'error-glyph',
                    glyphMarginHoverMessage: { value: err.message }
                }
            }));

            errorDecorations = editor.deltaDecorations([], decorations);
        },

        goToLine(line) {
            editor.revealLineInCenter(line);
            editor.setPosition({ lineNumber: line, column: 1 });
            editor.focus();
        },

        dispose() {
            editor.dispose();
        },

        focus() {
            editor.focus();
        },

        getCurrentLine() {
            return editor.getPosition()?.lineNumber || 1;
        }
    };

    return wrapper;
}

export function parseGLSLErrors(errorMsg) {
    if (!errorMsg) return [];

    const errors = [];
    const lines = errorMsg.split('\n');

    for (const line of lines) {
        // ERROR: 0:12: 'x' : undeclared identifier
        // ERROR: 0:15: syntax error
        // Line 12: error...
        const match = line.match(/(?:ERROR:\s*\d+:(\d+))|(?:line\s+(\d+))/i);
        if (match) {
            const lineNum = parseInt(match[1] || match[2], 10);
            if (!isNaN(lineNum)) {
                errors.push({
                    line: lineNum,
                    message: line.trim()
                });
            }
        }
    }

    return errors;
}

function addErrorStyles() {
    if (document.getElementById('monaco-error-styles')) return;

    const style = document.createElement('style');
    style.id = 'monaco-error-styles';
    style.textContent = `
        .error-line {
            background: rgba(255, 0, 0, 0.15) !important;
        }
        .error-glyph {
            background: #f44747;
            border-radius: 50%;
            margin-left: 3px;
        }
        .warning-line {
            background: rgba(255, 165, 0, 0.15) !important;
        }
        .warning-glyph {
            background: #ff9a70;
            border-radius: 50%;
            margin-left: 3px;
        }
        .monaco-fix-widget {
            background: #4a9eff;
            color: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-family: sans-serif;
            font-weight: bold;
            cursor: pointer;
            margin-left: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            transition: all 0.2s;
            pointer-events: all;
            z-index: 999;
        }
        .monaco-fix-widget:hover {
            background: #2a8eff;
            transform: translateY(-1px);
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        }
    `;
    document.head.appendChild(style);
}

addErrorStyles();

window.CreativeCodeMonaco = {
    loadMonaco,
    createMonacoEditor,
    parseGLSLErrors,
    GLSL_LANGUAGE_DEF,
    P5_ADDITIONS
};
