[npm]: https://img.shields.io/npm/v/rollup-plugin-node
[npm-url]: https://www.npmjs.com/package/rollup-plugin-node
[size]: https://packagephobia.now.sh/badge?p=rolup-plugin-node
[size-url]: https://packagephobia.now.sh/result?p=rollup-plugin-node

[![npm][npm]][npm-url]
[![size][size]][size-url]

# rolup-plugin-node

🍣 A Rollup plugin which improve rollup usage with nodejs projects 

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
import { rollupPluginNode } from 'rollup-plugin-node';

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

## Meta

[CONTRIBUTING](/.github/CONTRIBUTING.md)

[LICENSE (MIT)](/LICENSE)

