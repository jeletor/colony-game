// engine.js — Game loop, physics, rendering, collision, camera

const Engine = (() => {
  const TILE_SIZE = 32;
  const FPS = 60;

  let canvas, ctx;
  let running = false;
  let currentLevel = null;
  let currentLevelIndex = 0;
  let player = null;
  let enemies = [];
  let camera = { x: 0 };
  let particles = [];
  let screenShake = 0;
  let deathTimer = 0;
  let winTimer = 0;
  let transitioning = false;

  // Star field for background
  const stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * 1280,
      y: Math.random() * 480,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.3 + 0.1,
      brightness: Math.random() * 0.5 + 0.3,
    });
  }

  // Tile colors
  const TILE_COLORS = {
    1: { top: '#4a4a6a', body: '#3a3a5a', bottom: '#2a2a4a' }, // solid
    2: { top: '#5a6a5a', body: '#4a5a4a' },                     // platform
    3: '#e74c3c',                                                 // hazard
    4: '#fbbf24',                                                 // collectible
    5: '#7b68ee',                                                 // exit
  };

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    ctx = canvas.getContext('2d');
  }

  function loadLevel(index) {
    currentLevelIndex = index;
    const levelData = Levels.get(index);
    if (!levelData) {
      // Beat the game!
      showVictory();
      return;
    }

    currentLevel = levelData;
    transitioning = false;
    deathTimer = 0;
    winTimer = 0;
    particles = [];
    screenShake = 0;

    // Spawn player
    const oldScore = player ? player.score : 0;
    const oldLives = player ? player.lives : 3;
    player = Player.create(
      levelData.spawn.x * TILE_SIZE,
      levelData.spawn.y * TILE_SIZE - 32
    );
    player.score = oldScore;
    player.lives = oldLives;

    // Spawn enemies
    enemies = (levelData.enemies || []).map(e => Enemies.spawn(e));

    // Reset camera
    camera.x = Math.max(0, player.x - canvas.width / 3);
  }

  function start() {
    if (running) return;
    running = true;
    Input.init();
    loadLevel(0);
    requestAnimationFrame(loop);
  }

  function pause() { running = false; }
  function resume() { running = true; requestAnimationFrame(loop); }

  let lastTime = 0;
  function loop(timestamp) {
    if (!running) return;

    // Fixed timestep
    const elapsed = timestamp - lastTime;
    if (elapsed < 1000 / FPS) {
      requestAnimationFrame(loop);
      return;
    }
    lastTime = timestamp;

    update();
    render();
    Input.update();
    requestAnimationFrame(loop);
  }

  function update() {
    if (transitioning) return;

    if (!player.alive) {
      deathTimer++;
      updateParticles();
      if (deathTimer > 120) {
        if (player.lives > 0) {
          // Respawn same level
          const score = player.score;
          const lives = player.lives;
          loadLevel(currentLevelIndex);
          player.score = score;
          player.lives = lives;
        } else {
          // Game over — restart
          loadLevel(0);
          player.score = 0;
          player.lives = 3;
        }
      }
      return;
    }

    if (winTimer > 0) {
      winTimer++;
      updateParticles();
      if (winTimer > 90) {
        transitioning = true;
        loadLevel(currentLevelIndex + 1);
      }
      return;
    }

    // Update player
    const events = Player.update(player, Input, currentLevel.tiles);
    if (events) {
      const evList = Array.isArray(events) ? events : [events];
      for (const ev of evList) {
        if (ev.event === 'jump') Audio.playJump();
        if (ev.event === 'land') Audio.playLand();
        if (ev.event === 'collect') {
          Audio.playCollect();
          spawnCollectParticles(ev.col * TILE_SIZE + 16, ev.row * TILE_SIZE + 16);
        }
        if (ev.event === 'hurt') {
          Audio.playHurt();
          screenShake = 10;
        }
        if (ev.event === 'die') {
          Audio.playDeath();
          screenShake = 15;
          spawnDeathParticles(player.x + 12, player.y + 16);
        }
        if (ev.event === 'exit') {
          Audio.playPowerup();
          winTimer = 1;
          spawnWinParticles(player.x + 12, player.y + 16);
        }
      }
    }

    // Update enemies
    Enemies.updateAll(enemies, currentLevel.tiles);

    // Check enemy collision
    const enemyResult = Enemies.checkCollision(player, enemies);
    if (enemyResult) {
      if (enemyResult.stomped) {
        Audio.playCollect();
        spawnEnemyDeathParticles(enemyResult.stomped.x + 14, enemyResult.stomped.y + 14);
      } else if (enemyResult.hit) {
        player.invincible = 60;
        player.lives--;
        player.vy = -8;
        Audio.playHurt();
        screenShake = 10;
        if (player.lives <= 0) {
          player.alive = false;
          Audio.playDeath();
          spawnDeathParticles(player.x + 12, player.y + 16);
        }
      }
    }

    // Fall off bottom = death
    if (player.y > currentLevel.height * TILE_SIZE + 64) {
      player.alive = false;
      player.lives--;
      Audio.playDeath();
      deathTimer = 60; // shorter wait since they fell
    }

    // Camera follows player smoothly
    const targetX = player.x - canvas.width / 3;
    const maxX = currentLevel.width * TILE_SIZE - canvas.width;
    camera.x += (Math.max(0, Math.min(targetX, maxX)) - camera.x) * 0.1;

    // Update particles
    updateParticles();

    // Screen shake decay
    if (screenShake > 0) screenShake--;

    // Update HUD
    updateHUD();
  }

  function render() {
    ctx.save();

    // Screen shake
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake;
      const shakeY = (Math.random() - 0.5) * screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Background
    renderBackground();

    // Tiles
    renderTiles();

    // Enemies
    Enemies.renderAll(enemies, ctx, camera.x);

    // Player
    Player.render(player, ctx, camera.x);

    // Particles
    renderParticles();

    // Death overlay
    if (!player.alive) {
      ctx.fillStyle = `rgba(10, 10, 26, ${Math.min(deathTimer / 60, 0.7)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (deathTimer > 30) {
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 32px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(player.lives > 0 ? 'OUCH' : 'GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#888';
        ctx.font = '16px Courier New';
        ctx.fillText(player.lives > 0 ? 'Respawning...' : 'Restarting...', canvas.width / 2, canvas.height / 2 + 20);
      }
    }

    // Win overlay
    if (winTimer > 0) {
      ctx.fillStyle = `rgba(123, 104, 238, ${Math.min(winTimer / 60, 0.3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7b68ee';
      ctx.font = 'bold 28px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2);
    }

    ctx.restore();
  }

  function renderBackground() {
    // Dark gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0d0d1a');
    grad.addColorStop(1, '#1a1a3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax stars
    for (const star of stars) {
      const sx = ((star.x - camera.x * star.speed) % canvas.width + canvas.width) % canvas.width;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.fillRect(sx, star.y, star.size, star.size);
    }
  }

  function renderTiles() {
    if (!currentLevel) return;
    const tiles = currentLevel.tiles;

    const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
    const endCol = Math.min(currentLevel.width, Math.ceil((camera.x + canvas.width) / TILE_SIZE) + 1);

    for (let row = 0; row < currentLevel.height; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tile = tiles[row][col];
        if (tile === 0) continue;

        const x = col * TILE_SIZE - camera.x;
        const y = row * TILE_SIZE;

        switch (tile) {
          case 1: // Solid block
            ctx.fillStyle = TILE_COLORS[1].body;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = TILE_COLORS[1].top;
            ctx.fillRect(x, y, TILE_SIZE, 3);
            ctx.fillStyle = TILE_COLORS[1].bottom;
            ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
            // Subtle grid lines
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
            ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
            break;

          case 2: // Platform
            ctx.fillStyle = TILE_COLORS[2].top;
            ctx.fillRect(x, y, TILE_SIZE, 6);
            ctx.fillStyle = TILE_COLORS[2].body;
            ctx.fillRect(x + 4, y + 6, 4, 6);
            ctx.fillRect(x + TILE_SIZE - 8, y + 6, 4, 6);
            break;

          case 3: // Hazard (spikes)
            ctx.fillStyle = '#e74c3c';
            for (let s = 0; s < 4; s++) {
              const sx = x + s * 8;
              ctx.beginPath();
              ctx.moveTo(sx, y + TILE_SIZE);
              ctx.lineTo(sx + 4, y + 6);
              ctx.lineTo(sx + 8, y + TILE_SIZE);
              ctx.fill();
            }
            ctx.fillStyle = '#c0392b';
            for (let s = 0; s < 4; s++) {
              const sx = x + s * 8;
              ctx.beginPath();
              ctx.moveTo(sx + 1, y + TILE_SIZE);
              ctx.lineTo(sx + 4, y + 10);
              ctx.lineTo(sx + 7, y + TILE_SIZE);
              ctx.fill();
            }
            break;

          case 4: // Collectible (coin)
            const bob = Math.sin(Date.now() / 300 + col) * 3;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + bob, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2 + bob, 5, 0, Math.PI * 2);
            ctx.fill();
            // Sparkle
            ctx.fillStyle = '#fef3c7';
            ctx.fillRect(x + TILE_SIZE / 2 - 1, y + TILE_SIZE / 2 + bob - 1, 2, 2);
            break;

          case 5: // Exit
            const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(123, 104, 238, ${pulse})`;
            ctx.fillRect(x + 4, y, TILE_SIZE - 8, TILE_SIZE);
            ctx.fillStyle = `rgba(139, 120, 255, ${pulse})`;
            ctx.fillRect(x + 8, y + 4, TILE_SIZE - 16, TILE_SIZE - 8);
            // Arrow
            ctx.fillStyle = '#fff';
            ctx.font = '18px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('⬆', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 6);
            break;
        }
      }
    }
  }

  // ── Particles ──
  function spawnCollectParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 30,
        maxLife: 30,
        color: Math.random() > 0.5 ? '#fbbf24' : '#fef3c7',
        size: Math.random() * 3 + 2,
      });
    }
  }

  function spawnDeathParticles(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 / 20) * i;
      particles.push({
        x, y,
        vx: Math.cos(angle) * (Math.random() * 4 + 1),
        vy: Math.sin(angle) * (Math.random() * 4 + 1) - 2,
        life: 50,
        maxLife: 50,
        color: Math.random() > 0.5 ? '#7b68ee' : '#e74c3c',
        size: Math.random() * 4 + 2,
      });
    }
  }

  function spawnEnemyDeathParticles(x, y) {
    for (let i = 0; i < 10; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5 - 2,
        life: 25,
        maxLife: 25,
        color: '#e74c3c',
        size: Math.random() * 3 + 2,
      });
    }
  }

  function spawnWinParticles(x, y) {
    for (let i = 0; i < 25; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 4 - 1,
        life: 60,
        maxLife: 60,
        color: ['#7b68ee', '#fbbf24', '#2ecc71', '#e74c3c', '#fff'][Math.floor(Math.random() * 5)],
        size: Math.random() * 4 + 2,
      });
    }
  }

  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function renderParticles() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camera.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ── HUD ──
  function updateHUD() {
    document.getElementById('score-val').textContent = player.score;
    document.getElementById('level-val').textContent = currentLevelIndex + 1;
    const heartsEl = document.querySelector('#hud .lives');
    heartsEl.textContent = '♥'.repeat(Math.max(0, player.lives));
  }

  // ── Victory screen ──
  function showVictory() {
    running = false;
    ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#7b68ee';
    ctx.font = 'bold 36px Courier New';
    ctx.fillText('🎮 YOU WIN!', canvas.width / 2, canvas.height / 2 - 40);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '22px Courier New';
    ctx.fillText(`Final Score: ${player.score}`, canvas.width / 2, canvas.height / 2 + 10);

    ctx.fillStyle = '#888';
    ctx.font = '16px Courier New';
    ctx.fillText('Built by AI agents from The Colony', canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('Press SPACE to play again', canvas.width / 2, canvas.height / 2 + 80);

    document.addEventListener('keydown', function restart(e) {
      if (e.code === 'Space') {
        document.removeEventListener('keydown', restart);
        running = true;
        player = null;
        loadLevel(0);
        requestAnimationFrame(loop);
      }
    });
  }

  function getPlayer() {
    return player;
  }

  return { init, start, pause, resume, loadLevel, getPlayer };
})();
