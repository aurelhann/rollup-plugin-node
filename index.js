const MagicString = require('magic-string');
const utils = require('@rollup/pluginutils');
const path =require('path');
const fs = require('fs');

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
    const { delimiters, finalRenderES7 = false, additionalOptionalDeps = {} } = options;

    if(typeof additionalOptionalDeps !== 'object')
        throw new Error('additionalOptionaDeps optioni is not a valid object')

    const additionalOptionaDepsKeys = Object.keys(additionalOptionalDeps);

    const replacements = {
        // 'commonjsRequire.resolve': 'require.resolve', // workaround for promise.resolve usage and commonjs plugin
    }
    const optionalES5RegexTemplate = `[\\w\\s=_\\$\\(]*require\\(((\\'|\\")(.*)LIBRARY_NAME(\\'|\\"))\\)(.)*\\n`
    const optionalES7RegexTemplate = `import [\\w$0-9]* from (\\'|\\")((.*)LIBRARY_NAME)(\\'|\\")(.)*\\n`
    let optionalRegexTemplate = (finalRenderES7) ? optionalES7RegexTemplate : optionalES5RegexTemplate;

    const functionValues = mapToFunctions(getReplacements(replacements));
    const keys = Object.keys(functionValues)
        .sort(longest)
        .map(escape);

    const optionalDeps = [];
    const optionalDepsInternal = [];

    const pattern = delimiters
        ? new RegExp(`${escape(delimiters[0])}(${keys.join('|')})${escape(delimiters[1])}`, 'g')
        : new RegExp(`\\b(${keys.join('|')})\\b`, 'g');

    return {
        name: 'nodejs',

        resolveId ( source ) {
            // Test additional internal optional dep
            if(additionalOptionaDepsKeys?.length !== 0){
                let additionalSource;
                additionalOptionaDepsKeys.forEach(partialNaming => {
                    if(source.includes(partialNaming)){
                        additionalSource = partialNaming
                    }
                });
                if(additionalSource){
                    //console.log(`Library call detect as optional: ${source}`)
                    optionalDepsInternal.push({
                        source: source.split('?')[0],
                        dep: additionalSource
                    });
                    return {id: source, external: true};
                }
            }

            if (!source.includes(path.sep) && nodeNativeDeps.includes(source.split('?')[0])){
                // You enter here for native nodejs native lib -> we set external lib
                return {id: source, external: true};
            } else if (!source.includes(path.sep) && !nodeNativeDeps.includes(source.split('?')[0])){
                // We enter here for optional or peer dep -> set to external and try to bundle as optional dep (try catch around)
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

        generateBundle(assetInfos, bundleInfo){
            // remove same values
            const finalOptionalDeps = Array.from(new Set(optionalDeps));

            for(let [key, value] of Object.entries(bundleInfo)) {
                // for classic option dep
                finalOptionalDeps.forEach( optionalLibrary => {
                    console.log(getRegexFromLibraryName(optionalLibrary))
                    value.code = value.code.replaceAll(getRegexFromLibraryName(optionalLibrary), '')
                })

                // for specific internal dep
                optionalDepsInternal.forEach( optionalInternalLib => {
                    const intermediateFinalPath = optionalInternalLib.source.split(path.sep);
                    const finalPath = path.join(additionalOptionalDeps[optionalInternalLib.dep] || './', intermediateFinalPath[intermediateFinalPath.length - 1])

                    let myExec;
                    const regexOptionalInternal = getRegexFromLibraryName(optionalInternalLib.dep)
                    while ((optsDep = regexOptionalInternal.exec(value.code)) !== null) {
                        value.code = value.code.replaceAll(optsDep[1], `'./${finalPath}'`)
                    }

                    const dest = path.resolve(path.dirname(assetInfos.file), finalPath)
                    const from = optionalInternalLib.source
                    if(fs.existsSync(from)){
                        try {
                            if(!fs.existsSync(path.dirname(dest))){
                                fs.mkdirSync(path.dirname(dest))
                            }

                            fs.copyFileSync(from, dest)
                            console.log(`The copy of ${from} succeed`)
                        } catch(e){
                            console.log(`The copy of ${from} failed`)
                        }
                    } else {
                        console.log(`Warn: Missing optional internal dep source: ${from}`)
                    }
                })
            }
        }

    };

    function getRegexFromLibraryName(libraryName){
        return new RegExp(optionalRegexTemplate.replace('LIBRARY_NAME', libraryName), 'g');
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
            magicString.overwrite(start, end, finalReplacment);
        }
        return result;
    }

    function isSourceMapEnabled() {
        return options.sourceMap !== false && options.sourcemap !== false;
    }
}
