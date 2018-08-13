/* eslint-disable no-console */
/*globals toml, Vue, parser*/
(function() {
  'use strict';

  function parseModelText(text) {
    try {
      const result = toml.parse(text);
      return {ok: true, data: result};
    } catch (e) {
      return {ok: false, error: e};
    }
  }

  function getModelTag() {
    const nodes = document.querySelectorAll('script[type="ikuste-model"]');

    if (nodes.length === 0) {
      return null;
    }
    {
      return nodes[0];
    }
  }

  function getModelTagContent() {
    const node = getModelTag();
    if (node === null) {
      return '';
    } else {
      return node.innerText;
    }
  }

  function parseModel() {
    const modelText = getModelTagContent(),
      parseResult = parseModelText(modelText);

    if (parseResult.ok) {
      return parseResult.data;
    } else {
      const e = parseResult.error;
      alert(
        'Parsing error on line ' +
          e.line +
          ', column ' +
          e.column +
          ': ' +
          e.message
      );
      return {};
    }
  }

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

  function setupApp(model, appNodeId) {
    console.log(
      'initializing ikuste app @ ',
      appNodeId,
      'with model',
      jsonClone(model)
    );
    const methods = getDefaultMethods(),
      defaultMethodKeys = Object.keys(methods);

    document
      .querySelectorAll('script[type="ikuste-logic"]')
      .forEach(function(node) {
        const code = node.innerText,
          fullCode =
            'window.$ikusteTmpLogic = (function () { return ' +
            code.trim() +
            ';}())';
        console.log('compiling logic', fullCode);

        try {
          eval(fullCode);
          const logic = window.$ikusteTmpLogic;
          for (let name in logic) {
            console.log('adding', name, 'to methods');
            methods[name] = logic[name];
          }

          delete window.$ikusteTmpLogic;
        } catch (err) {
          console.error('error compiling logic', err);
        }
      });

    const app = new Vue({
      el: '#' + appNodeId,
      data: model,
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
    const model = parseModel(),
      node = getModelTag(),
      appNodeId = node.getAttribute('app') || 'ikuste-app';

    setupApp(model, appNodeId);
  }

  window.addEventListener('load', init);
})();
