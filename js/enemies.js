// enemies.js — Enemy types and AI

const Enemies = (() => {
  const TILE_SIZE = 32;
  const GRAVITY = 0.6;
  const TERMINAL_VEL = 10;

  function spawn(def) {
    const base = {
      x: def.x * TILE_SIZE,
      y: def.y * TILE_SIZE,
      vx: 0, vy: 0,
      width: 28, height: 28,
      alive: true,
      direction: 1,
      originX: def.x * TILE_SIZE,
      range: (def.range || 4) * TILE_SIZE,
      type: def.type || 'walker',
      frame: 0,
      shootTimer: 0,
    };

    switch (base.type) {
      case 'walker':
        base.vx = 1.2;
        break;
      case 'jumper':
        base.vx = 1.0;
        base.jumpTimer = 0;
        base.jumpInterval = 90; // frames between jumps
        base.grounded = false;
        break;
      case 'shooter':
        base.vx = 0;
        base.shootInterval = 120;
        base.shootTimer = 60; // start half-charged
        base.projectiles = [];
        break;
    }

    return base;
  }

  function getTile(tiles, col, row) {
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) return 1;
    return tiles[row][col];
  }

  function isSolid(t) { return t === 1; }

  function updateWalker(enemy, tiles) {
    enemy.x += enemy.vx * enemy.direction;

    // Reverse at range limits
    if (Math.abs(enemy.x - enemy.originX) > enemy.range) {
      enemy.direction *= -1;
      enemy.x = Math.max(enemy.originX - enemy.range,
                  Math.min(enemy.x, enemy.originX + enemy.range));
    }

    // Wall collision
    const col = enemy.direction > 0
      ? Math.floor((enemy.x + enemy.width) / TILE_SIZE)
      : Math.floor(enemy.x / TILE_SIZE);
    const row = Math.floor((enemy.y + enemy.height / 2) / TILE_SIZE);
    if (isSolid(getTile(tiles, col, row))) {
      enemy.direction *= -1;
    }

    // Edge detection — don't walk off ledges
    const footCol = enemy.direction > 0
      ? Math.floor((enemy.x + enemy.width) / TILE_SIZE)
      : Math.floor(enemy.x / TILE_SIZE);
    const belowRow = Math.floor((enemy.y + enemy.height + 2) / TILE_SIZE);
    const below = getTile(tiles, footCol, belowRow);
    if (!isSolid(below) && below !== 2) {
      enemy.direction *= -1;
    }

    // Gravity
    enemy.vy += GRAVITY;
    if (enemy.vy > TERMINAL_VEL) enemy.vy = TERMINAL_VEL;
    enemy.y += enemy.vy;

    // Floor collision
    const feetRow = Math.floor((enemy.y + enemy.height) / TILE_SIZE);
    const leftCol = Math.floor(enemy.x / TILE_SIZE);
    const rightCol = Math.floor((enemy.x + enemy.width - 1) / TILE_SIZE);
    for (let c = leftCol; c <= rightCol; c++) {
      const t = getTile(tiles, c, feetRow);
      if (isSolid(t) || t === 2) {
        enemy.y = feetRow * TILE_SIZE - enemy.height;
        enemy.vy = 0;
        break;
      }
    }
  }

  function updateJumper(enemy, tiles) {
    updateWalker(enemy, tiles);

    enemy.jumpTimer++;
    if (enemy.jumpTimer >= enemy.jumpInterval && enemy.vy === 0) {
      enemy.vy = -9;
      enemy.jumpTimer = 0;
    }
  }

  function updateShooter(enemy, tiles) {
    // Gravity
    enemy.vy += GRAVITY;
    if (enemy.vy > TERMINAL_VEL) enemy.vy = TERMINAL_VEL;
    enemy.y += enemy.vy;

    // Floor
    const feetRow = Math.floor((enemy.y + enemy.height) / TILE_SIZE);
    const col = Math.floor((enemy.x + enemy.width / 2) / TILE_SIZE);
    const t = getTile(tiles, col, feetRow);
    if (isSolid(t) || t === 2) {
      enemy.y = feetRow * TILE_SIZE - enemy.height;
      enemy.vy = 0;
    }

    // Shoot
    enemy.shootTimer++;
    if (enemy.shootTimer >= enemy.shootInterval) {
      enemy.shootTimer = 0;
      // Fire left and right
      enemy.projectiles.push({
        x: enemy.x - 4, y: enemy.y + 10,
        vx: -3, width: 8, height: 6, alive: true
      });
      enemy.projectiles.push({
        x: enemy.x + enemy.width, y: enemy.y + 10,
        vx: 3, width: 8, height: 6, alive: true
      });
    }

    // Update projectiles
    for (const p of enemy.projectiles) {
      p.x += p.vx;
      const pCol = Math.floor((p.x + p.width / 2) / TILE_SIZE);
      const pRow = Math.floor((p.y + p.height / 2) / TILE_SIZE);
      if (isSolid(getTile(tiles, pCol, pRow))) p.alive = false;
      if (p.x < -100 || p.x > 2000) p.alive = false;
    }
    enemy.projectiles = enemy.projectiles.filter(p => p.alive);
  }

  function updateAll(enemies, tiles) {
    for (const e of enemies) {
      if (!e.alive) continue;
      e.frame++;
      switch (e.type) {
        case 'walker': updateWalker(e, tiles); break;
        case 'jumper': updateJumper(e, tiles); break;
        case 'shooter': updateShooter(e, tiles); break;
      }
    }
  }

  function renderAll(enemies, ctx, cameraX) {
    for (const e of enemies) {
      if (!e.alive) continue;
      renderEnemy(e, ctx, cameraX);
    }
  }

  function renderEnemy(e, ctx, cameraX) {
    const x = e.x - cameraX;
    const y = e.y;

    switch (e.type) {
      case 'walker':
        // Red blocky creature
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 2, y + 4, 24, 20);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x + 4, y, 20, 8);
        // Angry eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 7, y + 8, 5, 5);
        ctx.fillRect(x + 16, y + 8, 5, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(x + (e.direction > 0 ? 10 : 7), y + 10, 2, 2);
        ctx.fillRect(x + (e.direction > 0 ? 19 : 16), y + 10, 2, 2);
        // Angry eyebrows
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x + 7, y + 6, 5, 2);
        ctx.fillRect(x + 16, y + 6, 5, 2);
        // Feet
        ctx.fillStyle = '#a93226';
        const ws = Math.floor(e.frame / 8) % 2;
        ctx.fillRect(x + 4 + ws * 3, y + 24, 8, 4);
        ctx.fillRect(x + 16 - ws * 3, y + 24, 8, 4);
        break;

      case 'jumper':
        // Green bouncy creature
        const squash = e.vy < 0 ? 0.85 : (e.vy > 2 ? 1.15 : 1);
        const stretch = e.vy < 0 ? 1.15 : (e.vy > 2 ? 0.85 : 1);
        ctx.save();
        ctx.translate(x + 14, y + 28);
        ctx.scale(squash, stretch);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-12, -24, 24, 20);
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(-10, -28, 20, 8);
        // Eyes (big and round)
        ctx.fillStyle = '#fff';
        ctx.fillRect(-7, -20, 6, 6);
        ctx.fillRect(1, -20, 6, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(-5, -18, 3, 3);
        ctx.fillRect(3, -18, 3, 3);
        // Feet
        ctx.fillStyle = '#1e8449';
        ctx.fillRect(-10, -4, 8, 4);
        ctx.fillRect(2, -4, 8, 4);
        ctx.restore();
        break;

      case 'shooter':
        // Purple turret
        ctx.fillStyle = '#8e44ad';
        ctx.fillRect(x + 4, y + 8, 20, 20);
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(x + 2, y + 4, 24, 8);
        // Eye (single, menacing)
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(x + 10, y + 12, 8, 6);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + 12, y + 13, 4, 4);
        // Gun barrels
        ctx.fillStyle = '#6c3483';
        ctx.fillRect(x - 4, y + 14, 8, 4);
        ctx.fillRect(x + 24, y + 14, 8, 4);
        // Charge indicator
        if (e.shootTimer > e.shootInterval * 0.7) {
          ctx.fillStyle = `rgba(243, 156, 18, ${(e.shootTimer / e.shootInterval)})`;
          ctx.fillRect(x + 11, y + 2, 6, 3);
        }
        // Projectiles
        for (const p of (e.projectiles || [])) {
          ctx.fillStyle = '#f39c12';
          ctx.fillRect(p.x - cameraX, p.y, p.width, p.height);
          ctx.fillStyle = '#ffeaa7';
          ctx.fillRect(p.x - cameraX + 2, p.y + 1, 4, 4);
        }
        break;
    }
  }

  function checkCollision(player, enemies) {
    if (player.invincible > 0) return null;

    for (const e of enemies) {
      if (!e.alive) continue;

      // Check main body collision
      if (boxOverlap(player, e)) {
        // Stomp: player falling and hitting top half of enemy
        if (player.vy > 0 && player.y + player.height - e.y < 16) {
          e.alive = false;
          player.vy = -8; // bounce
          player.score += 50;
          return { stomped: e };
        }
        return { hit: e };
      }

      // Check projectiles for shooters
      if (e.type === 'shooter') {
        for (const p of (e.projectiles || [])) {
          if (boxOverlap(player, p)) {
            p.alive = false;
            return { hit: e, projectile: true };
          }
        }
      }
    }
    return null;
  }

  function boxOverlap(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  return { spawn, updateAll, renderAll, checkCollision };
})();
