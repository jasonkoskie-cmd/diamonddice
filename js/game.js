/* ═══════════════════════════════════════════
   Diamond Dice — Game Engine
   Full step-by-step plate appearance resolution
═══════════════════════════════════════════ */

'use strict';

const Game = (() => {

                /* ─────────────────────────────────────────
       CONSTANTS
    ───────────────────────────────────────── */

                // d20 modifiers applied to the batter's roll
                const CONTACT_MOD  = { A: +2, B: +1, C:  0, D: -1 };
    // Applied to batter's d20 roll (negative = harder to hit)
                const PITCHING_MOD = { A: -2, B:  0, C:  0, D: +2 };
    // Applied to fielder's d6 roll (negative = better fielding = lower result = more outs)
                const FIELDING_MOD = { A: -1, B:  0, C:  0, D: +1 };

                // Fatigue modifier applied to batter's d20 roll (game-sensible interpretation)
                function getFatigueMod(d12) {
                      if (d12 <= 4)  return +1;   // Pitcher tires → easier for batter
      if (d12 <= 8)  return  0;   // Steady
      if (d12 <= 11) return -1;   // In rhythm → harder for batter
      return -2;                   // Dominant → much harder
                }
    function getFatigueLabel(d12) {
          if (d12 <= 4)  return 'Pitcher tires (+1 to batter)';
          if (d12 <= 8)  return 'Steady — no change';
          if (d12 <= 11) return 'In rhythm (−1 to batter)';
          return 'Dominant (−2 to batter)';
    }

                // Which fielding position to look up for each d8 location
                const LOC_TO_POS = { 1: null, 2: '1B', 3: '2B', 4: '3B', 5: 'RF', 6: 'LF', 7: 'RF', 8: 'LF' };
    const LOC_LABEL   = {
          1: 'Pitcher',       2: '1B side',     3: '2B / middle',
          4: '3B side',       5: 'Shallow RF',  6: 'Shallow LF',
          7: 'Deep RF/RC',    8: 'Deep LF/LC',
    };
