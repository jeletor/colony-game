// player.js — Player state, physics, rendering

const Player = (() => {
  const WIDTH = 24;
  const HEIGHT = 32;
  const MOVE_SPEED = 4;
  const JUMP_VEL = -12;
  const GRAVITY = 0.6;
  const TERMINAL_VEL = 10;
  const FRICTION = 0.8;
  const TILE_SIZE = 32;

  // Animation
  const BLINK_INTERVAL = 180; // frames between blinks
  const BLINK_DURATION = 8;

  function create(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      width: WIDTH, height: HEIGHT,
      grounded: false,
      alive: true,
      score: 0,
      lives: 3,
      facing: 1, // 1 = right, -1 = left
      frame: 0,
      invincible: 0, // invincibility frames after hit
      coyoteTime: 0, // frames since leaving ground (for forgiving jumps)
      jumpBuffered: false,
    };
  }

  function getTile(tiles, col, row) {
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) return 1; // walls
    return tiles[row][col];
  }

  function isSolid(tileType) {
    return tileType === 1;
  }

  function update(player, input, tiles) {
    if (!player.alive) return;

    player.frame++;
    if (player.invincible > 0) player.invincible--;

    // Horizontal movement
    if (input.isDown('left')) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    } else if (input.isDown('right')) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }

    // Coyote time (allows jumping a few frames after walking off edge)
    if (player.grounded) {
      player.coyoteTime = 6;
    } else {
      player.coyoteTime--;
    }

    // Jump buffering
    if (input.justPressed('jump') || input.justPressed('up')) {
      player.jumpBuffered = true;
      player.jumpBufferTimer = 6;
    }
    if (player.jumpBuffered) {
      player.jumpBufferTimer--;
      if (player.jumpBufferTimer <= 0) player.jumpBuffered = false;
    }

    // Jump
    if (player.jumpBuffered && player.coyoteTime > 0) {
      player.vy = JUMP_VEL;
      player.grounded = false;
      player.coyoteTime = 0;
      player.jumpBuffered = false;
      return { event: 'jump' };
    }

    // Variable jump height: release early = lower jump
    if (!input.isDown('jump') && !input.isDown('up') && player.vy < JUMP_VEL * 0.4) {
      player.vy *= 0.6;
    }

    // Gravity
    player.vy += GRAVITY;
    if (player.vy > TERMINAL_VEL) player.vy = TERMINAL_VEL;

    // Horizontal collision
    player.x += player.vx;
    const wasGrounded = player.grounded;
    resolveHorizontal(player, tiles);

    // Vertical collision
    player.y += player.vy;
    const landed = resolveVertical(player, tiles);

    // Check hazards & collectibles
    const events = checkTileInteractions(player, tiles);
    if (landed && !wasGrounded) {
      events.push({ event: 'land' });
    }

    return events.length ? events : null;
  }

  function resolveHorizontal(player, tiles) {
    const top = Math.floor(player.y / TILE_SIZE);
    const bottom = Math.floor((player.y + player.height - 1) / TILE_SIZE);

    if (player.vx > 0) {
      const col = Math.floor((player.x + player.width) / TILE_SIZE);
      for (let row = top; row <= bottom; row++) {
        if (isSolid(getTile(tiles, col, row))) {
          player.x = col * TILE_SIZE - player.width;
          player.vx = 0;
          break;
        }
      }
    } else if (player.vx < 0) {
      const col = Math.floor(player.x / TILE_SIZE);
      for (let row = top; row <= bottom; row++) {
        if (isSolid(getTile(tiles, col, row))) {
          player.x = (col + 1) * TILE_SIZE;
          player.vx = 0;
          break;
        }
      }
    }
  }

  function resolveVertical(player, tiles) {
    const left = Math.floor(player.x / TILE_SIZE);
    const right = Math.floor((player.x + player.width - 1) / TILE_SIZE);
    let landed = false;

    if (player.vy > 0) {
      // Falling
      const row = Math.floor((player.y + player.height) / TILE_SIZE);
      for (let col = left; col <= right; col++) {
        const tile = getTile(tiles, col, row);
        if (isSolid(tile) || tile === 2) { // solid or platform
          player.y = row * TILE_SIZE - player.height;
          player.vy = 0;
          if (!player.grounded) landed = true;
          player.grounded = true;
          return landed;
        }
      }
      player.grounded = false;
    } else if (player.vy < 0) {
      // Rising — only collide with solid, not platforms
      const row = Math.floor(player.y / TILE_SIZE);
      for (let col = left; col <= right; col++) {
        if (isSolid(getTile(tiles, col, row))) {
          player.y = (row + 1) * TILE_SIZE;
          player.vy = 0;
          break;
        }
      }
    }
    return landed;
  }

  function checkTileInteractions(player, tiles) {
    const events = [];
    const left = Math.floor(player.x / TILE_SIZE);
    const right = Math.floor((player.x + player.width - 1) / TILE_SIZE);
    const top = Math.floor(player.y / TILE_SIZE);
    const bottom = Math.floor((player.y + player.height - 1) / TILE_SIZE);

    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const tile = getTile(tiles, col, row);
        if (tile === 3 && player.invincible <= 0) {
          // Hazard
          events.push({ event: 'hurt' });
          player.invincible = 60;
          player.lives--;
          if (player.lives <= 0) {
            player.alive = false;
            events.push({ event: 'die' });
          } else {
            player.vy = JUMP_VEL * 0.6;
          }
        }
        if (tile === 4) {
          // Collectible
          tiles[row][col] = 0;
          player.score += 10;
          events.push({ event: 'collect', col, row });
        }
        if (tile === 5) {
          events.push({ event: 'exit' });
        }
      }
    }
    return events;
  }

  function render(player, ctx, cameraX) {
    if (!player.alive) return;

    // Flash when invincible
    if (player.invincible > 0 && Math.floor(player.invincible / 3) % 2) return;

    const x = player.x - cameraX;
    const y = player.y;

    ctx.save();

    // Body
    ctx.fillStyle = '#7b68ee';
    ctx.fillRect(x + 2, y + 8, 20, 24);

    // Head
    ctx.fillStyle = '#8b78ff';
    ctx.fillRect(x + 3, y, 18, 14);

    // Eyes
    const blinkFrame = player.frame % BLINK_INTERVAL;
    const isBlinking = blinkFrame < BLINK_DURATION;
    const eyeHeight = isBlinking ? 1 : 4;
    const eyeY = isBlinking ? y + 6 : y + 5;

    ctx.fillStyle = '#fff';
    if (player.facing > 0) {
      ctx.fillRect(x + 12, eyeY, 4, eyeHeight);
      ctx.fillRect(x + 8, eyeY, 4, eyeHeight);
    } else {
      ctx.fillRect(x + 8, eyeY, 4, eyeHeight);
      ctx.fillRect(x + 12, eyeY, 4, eyeHeight);
    }

    // Pupils
    if (!isBlinking) {
      ctx.fillStyle = '#1a1a2e';
      const pupilOffset = player.facing > 0 ? 2 : 0;
      ctx.fillRect(x + 8 + pupilOffset, y + 6, 2, 2);
      ctx.fillRect(x + 12 + pupilOffset, y + 6, 2, 2);
    }

    // Feet (animated when moving)
    ctx.fillStyle = '#5b48ce';
    if (Math.abs(player.vx) > 0.5 && player.grounded) {
      const step = Math.floor(player.frame / 6) % 2;
      ctx.fillRect(x + 3 + step * 4, y + 28, 7, 4);
      ctx.fillRect(x + 11 - step * 4, y + 28, 7, 4);
    } else {
      ctx.fillRect(x + 3, y + 28, 7, 4);
      ctx.fillRect(x + 14, y + 28, 7, 4);
    }

    ctx.restore();
  }

  return { create, update, render };
})();
