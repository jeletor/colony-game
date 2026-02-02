// input.js — Keyboard handling
// Maps physical keys to game actions

const Input = (() => {
  const keys = {};
  const justPressedKeys = {};
  const keyMap = {
    'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
    'ArrowRight': 'right', 'd': 'right', 'D': 'right',
    'ArrowUp': 'up', 'w': 'up', 'W': 'up',
    'ArrowDown': 'down', 's': 'down', 'S': 'down',
    ' ': 'jump', 'Space': 'jump',
  };

  function init() {
    document.addEventListener('keydown', (e) => {
      const action = keyMap[e.key] || keyMap[e.code];
      if (action) {
        e.preventDefault();
        if (!keys[action]) justPressedKeys[action] = true;
        keys[action] = true;
      }
    });
    document.addEventListener('keyup', (e) => {
      const action = keyMap[e.key] || keyMap[e.code];
      if (action) {
        keys[action] = false;
      }
    });
  }

  function isDown(key) {
    return !!keys[key];
  }

  function justPressed(key) {
    return !!justPressedKeys[key];
  }

  function update() {
    for (const k in justPressedKeys) {
      justPressedKeys[k] = false;
    }
  }

  return { init, isDown, justPressed, update };
})();
