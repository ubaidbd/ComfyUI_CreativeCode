
// ============================================
// CREATIVE CODE - CENTRAL CONSTANTS
// ============================================

// -- Preview Dimensions --
export const PREVIEW_WIDTH = 320;
export const PREVIEW_HEIGHT = 180;

// -- Editor Configuration --
export const EDITOR_FONT_SIZE = 12;
export const EDITOR_FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace";
export const EDITOR_MIN_HEIGHT = 250;

// -- Node Dimensions --
export const NODE_DEFAULT_WIDTH = 620;
export const NODE_DEFAULT_HEIGHT = 760;
export const NODE_MIN_WIDTH = 600;
export const NODE_MIN_HEIGHT = 600;

// -- Timing (ms) --
export const DEBOUNCE_DELAY_MS = 400;
export const SIZE_DEBOUNCE_DELAY_MS = 500;
export const SYNC_POLLING_INTERVAL_MS = 1000;
export const MONACO_LAYOUT_DELAY_MS = 100;

// -- Theme Colors --
export const THEME_BG_DARK = "#0d0f11";
export const THEME_BG_MEDIUM = "#121212";
export const THEME_ACCENT_CYAN = "#00bcd4";
export const THEME_ACCENT_GREEN = "#4caf50";
export const THEME_TEXT_PRIMARY = "#eee";
export const THEME_TEXT_SECONDARY = "#888";

// -- Minimal Fallback Shaders --
export const DEFAULT_SHADER = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    fragColor = vec4(col, 1.0);
}`;

export const DEFAULT_P5 = `function setup() {
    createCanvas(400, 400);
}
function draw() {
    background(30);
    fill(255, 100, 100);
    ellipse(width/2, height/2, 100, 100);
}`;
