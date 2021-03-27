[npm]: https://img.shields.io/npm/v/rollup-plugin-node
[npm-url]: https://www.npmjs.com/package/rollup-plugin-node
[size]: https://packagephobia.now.sh/badge?p=rolup-plugin-node
[size-url]: https://packagephobia.now.sh/result?p=rollup-plugin-node

[![npm][npm]][npm-url]
[![size][size]][size-url]

# rolup-plugin-node

🍣 A Rollup plugin which improve rollup usage with nodejs projects 

This plugin declares all nodejs native deps in external and try to remove require/import for all unknown others.
It's solve (most of the time) optional import from an external library that rollup actually don't manage very well ;). 

## Requirements

This plugin requires an [LTS](https://github.com/nodejs/Release) Node version (v12.0.0+) and Rollup v1.20.0+.

## Install

Using npm:

```console
npm install rollup-plugin-node --save-dev
```

## Usage

Create a `rollup.config.js` [configuration file](https://www.rollupjs.org/guide/en/#configuration-files) and import the plugin:

```js
import rollupPluginNode from 'rollup-plugin-node';

export default {
  input: 'src/index.js',
  output: {
    dir: 'output',
    format: 'cjs'
  },
  plugins: [rollupPluginNode()]
};
```
That all!!

Tips: put it after commonjs node

