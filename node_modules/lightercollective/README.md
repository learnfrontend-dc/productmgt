# lightercollective

[![donate](https://img.shields.io/badge/$-donate-ff69b4.svg?maxAge=2592000&style=flat)](https://github.com/WebReflection/donate)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

A lighter opencollective postinstall alternative.

If your `package.json` contains, as example, these entries:
```js
{
  "name": "hyperhtml",
  "scripts": {
    "postinstall": "opencollective postinstall"
  },
  "dependencies": {
    "opencollective": "^1.0.3"
  },
  "collective": {
    "type": "opencollective",
    "url": "https://opencollective.com/hyperhtml",
    "logo": "https://opencollective.com/hyperhtml/logo.txt"
  }
}
```

all you need to do is to replace `postinstall` and `dependencies` with `lightercollective`.

```js
{
  "name": "hyperhtml",
  "scripts": {
    "postinstall": "lightercollective"
  },
  "dependencies": {
    "lightercollective": "^0.0.0"
  },
  "collective": {
    "type": "opencollective",
    "url": "https://opencollective.com/hyperhtml",
    "logo": "https://opencollective.com/hyperhtml/logo.txt"
  }
}
```

The goal of this project is to be as small as possible, if not smaller.
