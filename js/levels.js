// levels.js — Level data and loader
// Tile types: 0=air, 1=solid, 2=platform, 3=hazard, 4=collectible, 5=exit

const Levels = (() => {
  const LEVELS = [];

  // Helper: create a level from a visual string map
  function parseLevel(name, map, enemies = []) {
    const rows = map.trim().split('\n').map(r => r.trimEnd());
    const height = rows.length;
    const width = Math.max(...rows.map(r => r.length));
    const tiles = [];
    let spawn = { x: 2, y: height - 3 };
    let exit = { x: width - 3, y: height - 3 };

    for (let row = 0; row < height; row++) {
      tiles[row] = [];
      for (let col = 0; col < width; col++) {
        const ch = (rows[row] || '')[col] || ' ';
        switch (ch) {
          case '#': tiles[row][col] = 1; break;  // solid
          case '-': tiles[row][col] = 2; break;  // platform
          case '^': tiles[row][col] = 3; break;  // hazard (spikes)
          case 'o': tiles[row][col] = 4; break;  // collectible
          case 'X': tiles[row][col] = 5; exit = { x: col, y: row }; break;
          case 'S': tiles[row][col] = 0; spawn = { x: col, y: row }; break;
          default:  tiles[row][col] = 0; break;  // air
        }
      }
    }

    return { name, width, height, spawn, exit, tiles, enemies };
  }

  // ── Level 1: "First Steps" ──
  LEVELS.push(parseLevel('First Steps', `
########################################
#                                      #
#                                      #
#                                      #
#                                      #
#          o  o  o                     #
#         --------            X        #
#                          --------    #
#    o                 o o             #
#  -----         ---------             #
#              o                       #
#S        ---------             ####   #
#                                      #
####  ^^^^    ####^^^^####    ^^^^  ####
########################################
`));

  // ── Level 2: "Up We Go" ──
  LEVELS.push(parseLevel('Up We Go', `
########################################
#                 X                    #
#               -----                  #
#          o               o           #
#        -----           -----         #
#   o                          o       #
#  -----    o    o    o    -----       #
#          ---  ---  ---               #
#                              ####    #
#                          o           #
#        ^^^^       ^^^^  ---          #
#  ####       ####                     #
#S                            o        #
####  ^^^^  ##    ##  ^^^^  ----  #### #
########################################
`, [
    { type: 'walker', x: 20, y: 12, range: 5 },
    { type: 'walker', x: 30, y: 12, range: 4 },
  ]));

  // ── Level 3: "Spike Cavern" ──
  LEVELS.push(parseLevel('Spike Cavern', `
########################################
#                                      #
#      o     o     o     o     o       #
#    ----  ----  ----  ----  ----      #
#                                      #
#  o                              X    #
# ---                           ----   #
#       o     o     o     o            #
#     ----  ----  ----  ----           #
#                                      #
#S  o                            o     #
##  --                          --  ## #
#      o     o     o     o             #
##  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  ## #
########################################
`, [
    { type: 'walker', x: 10, y: 10, range: 6 },
    { type: 'walker', x: 25, y: 10, range: 6 },
    { type: 'jumper', x: 18, y: 6, range: 4 },
  ]));

  // ── Level 4: "The Gauntlet" ──
  LEVELS.push(parseLevel('The Gauntlet', `
########################################
#                                      #
#S                                     #
###                                    #
#     o  o  o                          #
#    ----------                        #
#                   o  o  o            #
#         ^^^^    ----------     X     #
#       ######                ######   #
#                  ^^^^               ##
#  o        o    ######    o           #
# ---      ---            ---          #
#                 o  o                 #
####  ^^^^  ##  ------  ##  ^^^^  #### #
########################################
`, [
    { type: 'walker', x: 14, y: 4, range: 5 },
    { type: 'jumper', x: 28, y: 6, range: 3 },
    { type: 'walker', x: 22, y: 12, range: 4 },
    { type: 'shooter', x: 35, y: 8 },
  ]));

  // ── Level 5: "Colony Heights" ──
  LEVELS.push(parseLevel('Colony Heights', `
########################################
#             X                        #
#           -----                      #
#      o           o                   #
#    -----       -----                 #
#  o                     o             #
# ---     o   o   o    -----          #
#       ---- ---- ----                 #
#                              o       #
#    ^^^^       ^^^^         -----     #
#  ######     ######   o              #
#                     ---    ^^^^      #
#S                         ######      #
####  ^^^^  ####  ^^^^  ####    ###### #
########################################
`, [
    { type: 'walker', x: 8, y: 12, range: 4 },
    { type: 'walker', x: 20, y: 10, range: 5 },
    { type: 'jumper', x: 15, y: 6, range: 3 },
    { type: 'jumper', x: 30, y: 8, range: 4 },
    { type: 'shooter', x: 35, y: 4 },
  ]));

  function get(index) {
    return LEVELS[index] || null;
  }

  function count() {
    return LEVELS.length;
  }

  return { get, count };
})();
