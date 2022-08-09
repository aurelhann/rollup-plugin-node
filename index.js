const MagicString = require('magic-string');
const utils = require('@rollup/pluginutils');
const path =require('path');

const nodeNativeDeps = ['async_hooks', 'tls', 'crypto', 'http', 'fs', 'path', 'events', 'url', 'net', 'zlib', 'tty', 'querystring', 'util', 'buffer', 'domain', 'stream', 'os', 'https', 'string_decoder', 'assert', 'child_process', 'cluster', 'timers', 'vm', 'worker_threads', 'module', 'constants']


function escape(str) {
    return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

function ensureFunction(functionOrValue) {
    if (typeof functionOrValue === 'function') return functionOrValue;
    return () => functionOrValue;
}

function longest(a, b) {
    return b.length - a.length;
}

function getReplacements(options) {
    if (options.values) {
        return Object.assign({}, options.values);
    }
    const values = Object.assign({}, options);
    delete values.delimiters;
    delete values.include;
    delete values.exclude;
    delete values.sourcemap;
    delete values.sourceMap;
    return values;
}

function mapToFunctions(object) {
    return Object.keys(object).reduce((fns, key) => {
        const functions = Object.assign({}, fns);
        functions[key] = ensureFunction(object[key]);
        return functions;
    }, {});
}

module.exports = function rollupPluginNode(options = {}) {
    const filter = utils.createFilter(options.include, options.exclude);
    const { delimiters, finalRenderES7 = false } = options;

    const replacements = {
        // 'commonjsRequire.resolve': 'require.resolve', // workaround for promise.resolve usage and commonjs plugin
    }
    const optionalES5RegexTemplate = `[\\w\\s=_\\$\\(]*require\\((\\'|\\")LIBRARY_NAME(\\'|\\")\\)(.)*\\n`
    const optionalES7RegexTemplate = `import [\\w$0-9]* from (\\'|\\")LIBRARY_NAME(\\'|\\")(.)*\\n`
    let optionalRegexTemplate = (finalRenderES7) ? optionalES7RegexTemplate : optionalES5RegexTemplate;

    const functionValues = mapToFunctions(getReplacements(replacements));
    const keys = Object.keys(functionValues)
        .sort(longest)
        .map(escape);

    const optionalDeps = [];

    const pattern = delimiters
        ? new RegExp(`${escape(delimiters[0])}(${keys.join('|')})${escape(delimiters[1])}`, 'g')
        : new RegExp(`\\b(${keys.join('|')})\\b`, 'g');

    return {
        name: 'nodejs',

        resolveId ( source ) {
            if (!source.includes(path.sep) && nodeNativeDeps.includes(source.split('?')[0])){
                return {id: source, external: true};
            } else if (!source.includes(path.sep) && !nodeNativeDeps.includes(source.split('?')[0])){
                optionalDeps.push(source.split('?')[0]);
                return {id: source, external: true};
            }
            return null; // other ids should be handled as usually
        },

        renderChunk(code, chunk) {
            const id = chunk.fileName;
            if (!keys.length) return null;
            if (!filter(id)) return null;
            return executeReplacement(code, id);
        },

        transform(code, id) {
            if (!keys.length) return null;
            if (!filter(id)) return null;
            return executeReplacement(code, id);
        },

        generateBundle(options, bundleInfo){
            // remove same values
            const finalOptionalDeps = Array.from(new Set(optionalDeps));

            for(let [key, value] of Object.entries(bundleInfo)) {
                finalOptionalDeps.forEach( optionalLibrary => {
                    console.log(getRegexFromLibraryName(optionalLibrary))
                    value.code = value.code.replace(getRegexFromLibraryName(optionalLibrary), '')
                })
            }
        }

    };

    function getRegexFromLibraryName(libraryName){
        return new RegExp(optionalRegexTemplate.replace('LIBRARY_NAME', libraryName));
    }

    function executeReplacementChunk(code, id){
        const magicString = new MagicString(code);

        // execute specific chunk replacement for optional deps
        console.log(new RegExp(optionalRegexTemplate,'g'))
        // if(code.includes('bufferutil'))
        codeHasReplacements(code, id, magicString, new RegExp(optionalRegexTemplate,'g'))

        if (!codeHasReplacements(code, id, magicString)) {
            return null;
        }

        const result = { code: magicString.toString() };
        if (isSourceMapEnabled()) {
            result.map = magicString.generateMap({ hires: true });
        }
        return result;
    }

    function executeReplacement(code, id) {
        const magicString = new MagicString(code);
        if (!codeHasReplacements(code, id, magicString)) {
            return null;
        }

        const result = { code: magicString.toString() };
        if (isSourceMapEnabled()) {
            result.map = magicString.generateMap({ hires: true });
        }
        return result;
    }

    function codeHasReplacements(code, id, magicString, specificPattern = undefined, replacement = '') {
        let result = false;
        let match;

        const patternToExecute = specificPattern ? specificPattern : pattern;


        // eslint-disable-next-line no-cond-assign
        while ((match = patternToExecute.exec(code)) !== null) {
            result = true;

            const start = match.index;
            const end = start + match[0].length;

            const finalReplacment = specificPattern ? replacement : String(functionValues[match[1]](id));
            if(match[1].includes('bufferutil')) console.log(finalReplacment)
            magicString.overwrite(start, end, finalReplacment);
        }
        return result;
    }

    function isSourceMapEnabled() {
        return options.sourceMap !== false && options.sourcemap !== false;
    }
}
