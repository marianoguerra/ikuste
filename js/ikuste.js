/* eslint-disable no-console */
/*globals Vue, parser*/
(function() {
  'use strict';

  function Scope(bindings, parent) {
    this.parent = parent || null;
    this.bindings = bindings || {};
  }

  Scope.prototype.get = function(name, defaultValue) {
    const value = this.bindings[name];

    if (value === undefined) {
      const parent = this.parent;
      if (parent !== null) {
        return parent.get(name, defaultValue);
      } else {
        return defaultValue;
      }
    } else {
      return value;
    }
  };

  Scope.prototype.set = function(name, value) {
    this.bindings[name] = value;
  };

  function resolvePath(parsed, scopes, data) {
    const curPath = [];

    let node = data,
      parent = data,
      lastKey = null,
      ok = true;

    for (let i = 0, len = parsed.length; i < len; i += 1) {
      if (node === undefined) {
        ok = false;
        break;
      }

      const item = parsed[i];

      lastKey = item[1];
      parent = node;

      switch (item[0]) {
        case 'i':
          node = node[lastKey];
          break;
        case 'n':
          node = node[lastKey];
          break;
        case 'v':
          lastKey = scopes.get(lastKey);
          node = node[lastKey];
          break;
        case 'm':
          lastKey = resolvePath(lastKey, scopes, data).node;
          node = node[lastKey];
          break;
      }

      curPath.push(lastKey);
    }

    return {
      ok: ok,
      node: node,
      parent: parent,
      lastKey: lastKey,
      path: parsed,
      curPath: curPath
    };
  }

  function compilePath(path) {
    const parsed = parser.parse(path);
    return function(scopes, data) {
      return resolvePath(parsed, scopes, data);
    };
  }

  const pathCache = {};
  function parsePath(path) {
    const cached = pathCache[path];
    if (cached === undefined) {
      const compiled = compilePath(path);
      pathCache[path] = compiled;
      return compiled;
    }

    return cached;
  }

  function logInvalidArrayIndex(list, index) {
    console.error(
      "can't remove item from list, field is not a valid list index, list:",
      list,
      'list length:',
      list.length,
      ', index',
      index
    );
  }

  function jsonClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function logCantAddToList(node, path, key) {
    console.error('cant add field to list', node, key, path);
  }

  function logCantAppendToNonList(node, path) {
    console.error('can only append to list', node, path);
  }

  function logCantAddToNotDefined(node, path, key) {
    console.error('cant add field to not defined value', node, key, path);
  }

  function getDefaultMethods() {
    return {
      $add: function(path, value, bindings) {
        const scope = new Scope(bindings),
          compiledPath = parsePath(path),
          info = compiledPath(scope, this),
          node = info.ok ? info.parent : null,
          key = info.ok ? info.lastKey : null;

        if (Array.isArray(node)) {
          logCantAddToList(node, path, key);
        } else if (node !== undefined && node !== null) {
          Vue.set(node, key, value);
        } else {
          logCantAddToNotDefined(node, path, key);
        }
      },
      $append: function(path, value, bindings) {
        const scope = new Scope(bindings),
          compiledPath = parsePath(path),
          info = compiledPath(scope, this),
          node = info.ok ? info.node : null;

        if (Array.isArray(node)) {
          node.push(value);
        } else {
          logCantAppendToNonList(node, path);
        }
      },
      $setField: function(path, value, bindings) {
        const scope = new Scope(bindings),
          compiledPath = parsePath(path),
          info = compiledPath(scope, this),
          node = info.ok ? info.parent : null,
          key = info.ok ? info.lastKey : null;

        if (node) {
          Vue.set(node, key, value);
        }
      },
      $remove: function(path, bindings) {
        const scope = new Scope(bindings),
          compiledPath = parsePath(path),
          info = compiledPath(scope, this),
          node = info.ok ? info.parent : null,
          field = info.ok ? info.lastKey : null;

        if (Array.isArray(node)) {
          if (typeof field === 'number') {
            if (Number.isFinite(field)) {
              node.splice(field, 1);
            } else {
              logInvalidArrayIndex(node, field);
            }
          } else {
            logInvalidArrayIndex(node, field);
          }
        } else {
          console.log('deleting', field, 'from', node);
          Vue.delete(node, field);
          return;
        }
      }
    };
  }

  function setupApps() {
    const methods = getDefaultMethods(),
      defaultMethodKeys = Object.keys(methods),
      node = document.querySelectorAll('script[type="ikuste"]')[0];

    if (!node) {
      alert('ikuste node not found');
      return;
    }

    const code = node.innerText,
      fullCode =
        'window.$ikusteTmp = (function () { return ' + code.trim() + ';}())';

    console.log('compiling logic', fullCode);

    let appInfo;
    try {
      eval(fullCode);
      appInfo = window.$ikusteTmp;

      delete window.$ikusteTmp;
    } catch (err) {
      console.error(
        'error compiling ikuste, at line',
        err.lineNumber,
        'code at line: ',
        fullCode[err.lineNumber],
        err
      );
      for (let key in err) {
        console.log(key, err[key]);
      }
      return;
    }

    if (!appInfo) {
      alert('ikuste app info not found');
      return;
    }

    const userMethods = appInfo.methods || {};

    for (let name in userMethods) {
      console.log('adding', name, 'to methods');
      methods[name] = userMethods[name];
    }

    if (typeof appInfo.data !== 'object') {
      alert('ikuste app data not found');
      return;
    }

    const appNodeId0 = node.getAttribute('app') || appInfo.el || 'app',
          appNodeId = appNodeId0[0] === '#' ? appNodeId0 : '#' + appNodeId0,
      appNode = document.getElementById(appNodeId.replace('#', '')),
      data = appInfo.data;

    if (!appNode) {
      alert(
        'ikuste app node (id "' +
          appNodeId0 +
          '") not found, make sure you set the id attribute on a node in your HTML'
      );
    }
    console.log(
      'initializing ikuste app @ ',
      appNodeId0,
      'with model',
      jsonClone(data), appInfo
    );

    const app = new Vue({
      el: appNodeId,
      data: data,
      methods: methods
    });

    for (let i = 0, len = defaultMethodKeys.length; i < len; i += 1) {
      const name = defaultMethodKeys[i];
      window[name] = function() {
        app[name].apply(app, arguments);
      };
    }

    return app;
  }

  function init() {
    setupApps();
  }

  window.addEventListener('load', init);
})();
