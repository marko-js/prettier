<h1 align="center">
  <!-- Logo -->
  <br/>
  prettier-plugin-marko
	<br/>

  <!-- Language -->
  <a href="http://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
  <!-- Format -->
  <a href="https://github.com/prettier/prettier">
    <img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with prettier"/>
  </a>
  <!-- CI -->
  <a href="https://github.com/marko-js/prettier/actions/workflows/ci.yml">
    <img src="https://github.com/marko-js/prettier/actions/workflows/ci.yml/badge.svg" alt="Build status"/>
  </a>
  <!-- Coverage -->
  <a href="https://codecov.io/gh/marko-js/prettier">
    <img src="https://codecov.io/gh/marko-js/prettier/branch/main/graph/badge.svg?token=v16tZuf0B1"/>
  </a>
  <!-- NPM Version -->
  <a href="https://npmjs.org/package/prettier-plugin-marko">
    <img src="https://img.shields.io/npm/v/prettier-plugin-marko.svg" alt="NPM Version"/>
  </a>
  <!-- Downloads -->
  <a href="https://npmjs.org/package/prettier-plugin-marko">
    <img src="https://img.shields.io/npm/dm/prettier-plugin-marko.svg" alt="Downloads"/>
  </a>
</h1>

A [Prettier](https://prettier.io/) plugin for parsing and printing Marko files.

# Installation

### npm

```console
npm install prettier prettier-plugin-marko -D
```

### yarn

```console
yarn add prettier prettier-plugin-marko -D
```

# Usage

## NPM 6

```console
npx --no-install prettier --write "**/*.marko"
```

## NPM 7

```console
npm exec -- prettier --write "**/*.marko"
```

## Yarn

```console
yarn prettier  --write "**/*.marko"
```

## Editors

Editors such as [Atom](https://atom.io/packages/prettier-atom) and [VSCode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) provide plugins for calling [Prettier](https://prettier.io/) directly from your editor.

If you'd like to use these plugins **without** installing `prettier-plugin-marko` in the project, you can also install `prettier-plugin-marko` globally with either [npm](https://docs.npmjs.com/downloading-and-installing-packages-globally), [yarn](https://classic.yarnpkg.com/en/docs/cli/global/) or your package manager choice.

# Options

On top of [Prettier's options](https://prettier.io/docs/en/options.html), there are a few additional options picked up by this plugin.

## `markoSyntax: "auto" | "html" | "concise"`

Marko supports both an [html like](https://markojs.com/docs/syntax/) and [concise](https://markojs.com/docs/concise/) syntaxes.
By default this plugin will try to detect the syntax you are already using and output a formatted document in that syntax.

You can overide the default (`"auto"`) to enforce that all templates are formatted to the syntax of your choosing.

## `markoAttrParen: boolean`

For the most part Marko is very flexible when it comes to the [expressions uses within attributes](https://markojs.com/docs/syntax/#attributes).
By default this plugin will not wrap attribute values in parenthesis unless absolutely necessary. By setting this value to true it will instead output parenthesis whenever the attribute value contains any unenclosed whitespace.

# Code of Conduct

This project adheres to the [eBay Code of Conduct](./.github/CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
