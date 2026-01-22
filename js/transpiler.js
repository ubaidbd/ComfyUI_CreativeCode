export function transpileProcessingToJS(code) {
    if (!code || typeof code !== 'string') {
        return code || '';
    }

    const strings = [];
    let result = code.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
        const placeholder = `__STRING_PLACEHOLDER_${strings.length}__`;
        strings.push(match);
        return placeholder;
    });

    const commentLines = result.split('\n');
    const commentProcessedLines = commentLines.map(line => {
        if (/^\s*#/.test(line)) {
            return line.replace(/^(\s*)#(.+)$/, '$1//$2');
        }
        const commentMatch = line.match(/^([^#]*?)([^\/\*"'`])\s*#(.+)$/);
        if (commentMatch) {
            return commentMatch[1] + commentMatch[2] + ' //' + commentMatch[3];
        }
        return line;
    });
    result = commentProcessedLines.join('\n');

    result = result.replace(/\bvoid\s+(setup|draw)\s*\(/g, 'function $1(');

    const lines = result.split('\n');
    const processedLines = lines.map(line => {
        let processedLine = line;

        if (!/\b(int|float|boolean)\s+/.test(processedLine)) {
            return processedLine;
        }

        processedLine = processedLine.replace(/\b(int|float|boolean)\s+([a-zA-Z_$][\w$]*)\s*\[\s*\]\s*=\s*new\s+(float|int|boolean)\s*\[([^\]]+)\]([^;]*);/g, (match, type, varName, arrayType, arraySize, rest) => {
            let restVars = rest.trim();
            if (restVars.startsWith(',')) {
                restVars = restVars.substring(1).trim();
            }
            if (restVars) {
                return `let ${varName} = new Array(${arraySize}), ${restVars};`;
            }
            return `let ${varName} = new Array(${arraySize});`;
        });

        processedLine = processedLine.replace(/\b(int|float|boolean)\s+([a-zA-Z_$][\w$]*)\s*\[\s*\]\s*;/g, 'let $2;');

        processedLine = processedLine.replace(/\bnew\s+(float|int|boolean)\s*\[([^\]]+)\]/g, 'new Array($2)');

        processedLine = processedLine.replace(/\b(int|float|boolean)\s+([^;]+);/g, (match, type, vars) => {
            let cleanedVars = vars.trim();
            cleanedVars = cleanedVars.replace(/([a-zA-Z_$][\w$]*)\s*\[\s*\]/g, '$1');
            cleanedVars = cleanedVars.replace(/\s*,\s*/g, ', ');
            return `let ${cleanedVars};`;
        });

        return processedLine;
    });

    result = processedLines.join('\n');

    result = result.replace(/\bsize\s*\(/g, 'createCanvas(');

    strings.forEach((str, i) => {
        result = result.replace(`__STRING_PLACEHOLDER_${i}__`, str);
    });

    return result;
}
