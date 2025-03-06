![GitHub CI](https://github.com/xremming/gontext/actions/workflows/build.yml/badge.svg)
[![codecov](https://codecov.io/github/xremming/gontext/graph/badge.svg?token=7UQQ4W9W7R)](https://codecov.io/github/xremming/gontext)

[![NPM](https://nodei.co/npm/gontext.png?compact=true)](https://nodei.co/npm/gontext/)

# Gontext

Go-like context for TypeScript and JavaScript. For the general design around the package see the [Go context package](https://golang.org/pkg/context/). Its name is a portmanteau of "Go" and "context".

Documentation and examples are still to be added but the package is fully functional.

## Requirements

Gontext uses and exposes APIs to the `AbortController` and `AbortSignal` classes. They are also required for the package to work as intended. Both of these classes have been widely available on both [browsers](https://caniuse.com/abortcontroller) and [Node.js](https://nodejs.org/api/globals.html#class-abortcontroller) for quite a while now.
