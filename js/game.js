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

  /* ─────────────────────────────────────────
     GAME STATE
  ───────────────────────────────────────── */

  let S = null;

  function freshPA() {
    return {
      d20Roll: null, d20Mod: null, d20Final: null, d20Category: null,
      d8Location: null,
      d6Roll: null, d6Final: null, d6Outcome: null,
      d4Roll: null,
      tagUpQueue: [],   // indices into S.bases that can tag up
      tagUpIdx: 0,
      tagUpRolls: [],   // { base, roll, result }
      isDP: false,      // double-play situation
      result: null,     // final play description for log
    };
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */

  function init(appState) {
    S = {
      teams:      appState.teams,  // [0]=visitor, [1]=home
      score:      [0, 0],
      inningRuns: [new Array(9).fill(null), new Array(9).fill(null)],
      hits:       [0, 0],
      errors:     [0, 0],

      inning:  1,
      half:    0,    // 0 = top (visitor bats), 1 = bottom (home bats)
      outs:    0,
      bases:   [null, null, null],  // [1B, 2B, 3B]

      batterIdx:  [0, 0],  // current batting order slot per team
      pitcherIdx: [0, 0],  // current pitcher index per team

      fatigueRolled: false,
      fatigueMod:    0,

      step:    'roll_fatigue',  // step machine
      pa:      freshPA(),
      rolling: false,           // animation lock

      log: [],
      extraInnings: false,
      gameOver: false,
    };

    addLog(`⚾ Play Ball! <strong>${esc(S.teams[0].name)}</strong> vs <strong>${esc(S.teams[1].name)}</strong>`);
    logHalfInningStart();
    render();
  }

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */

  const battingTeam  = () => S.teams[S.half];
  const fieldingTeam = () => S.teams[1 - S.half];
  const currentBatter  = () => battingTeam().battingOrder[S.batterIdx[S.half]];
  const currentPitcher = () => fieldingTeam().pitchingOrder[S.pitcherIdx[1 - S.half]];

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function addLog(msg) {
    S.log.unshift(msg);  // newest at top
    if (S.log.length > 60) S.log.pop();
  }

  function logHalfInningStart() {
    const half  = S.half === 0 ? 'Top' : 'Bottom';
    const ord   = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];
    const label = S.inning <= 9 ? (ord[S.inning - 1] || `${S.inning}th`) : `${S.inning}th (extra)`;
    addLog(`<em>▶ ${half} of the ${label} — ${esc(battingTeam().name)} batting</em>`);
  }

  function roll(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  // Find the fielding team's player covering a given position
  function getFielderRating(location) {
    const pos = LOC_TO_POS[location];
    if (!pos) return 'B'; // pitcher — use default
    const fielder = fieldingTeam().battingOrder.find(p => p && p.positions && p.positions.includes(pos));
    return fielder ? fielder.fielding : 'B';
  }

  // Runner display name
  function runnerName(runner) {
    if (!runner) return '';
    if (runner.ghost) return 'Ghost Runner';
    return runner.name || '?';
  }

  /* ─────────────────────────────────────────
     PITCHING CHANGE CHECK
  ───────────────────────────────────────── */

  function checkPitcherChange() {
    const fi = 1 - S.half;
    const pitcher = currentPitcher();
    const maxInnings = STAMINA_INNINGS[pitcher.stamina] || 5;
    // Count complete half-innings pitched (approximate by inning change)
    // We'll track innings pitched via half-inning counter on pitcher
    if (!pitcher._halfsPitched) pitcher._halfsPitched = 0;
    return pitcher._halfsPitched >= maxInnings * 2; // halfs = innings * 2
  }

  function advancePitcher() {
    const fi = 1 - S.half;
    const nextIdx = S.pitcherIdx[fi] + 1;
    if (nextIdx < S.teams[fi].pitchingOrder.length) {
      S.pitcherIdx[fi] = nextIdx;
      const newP = currentPitcher();
      S.fatigueRolled = false;
      S.fatigueMod = 0;
      addLog(`🔄 Pitching change — <strong>${esc(newP.name)}</strong> now pitching for ${esc(S.teams[fi].name)}`);
      return true;
    }
    return false;
  }

  /* ─────────────────────────────────────────
     STEP MACHINE — each step rolls one die
  ───────────────────────────────────────── */

  function stepRollFatigue() {
    if (S.fatigueRolled) { S.step = 'pre_pa'; render(); return; }
    const d = roll(12);
    S.fatigueMod    = getFatigueMod(d);
    S.fatigueRolled = true;
    addLog(`🎲 Fatigue d12: <strong>${d}</strong> — ${getFatigueLabel(d)}`);

    // Track pitcher halfs pitched
    const pitcher = currentPitcher();
    if (!pitcher._halfsPitched) pitcher._halfsPitched = 0;

    S.step = 'pre_pa';
    render();
  }

  function stepRollContact() {
    const batter  = currentBatter();
    const pitcher = currentPitcher();

    const base    = roll(20);
    const conMod  = CONTACT_MOD[batter.contact] || 0;
    const pitMod  = PITCHING_MOD[pitcher.pitching] || 0;
    const fatMod  = S.fatigueMod;
    const total   = Math.min(20, Math.max(1, base + conMod + pitMod + fatMod));

    S.pa.d20Roll  = base;
    S.pa.d20Mod   = conMod + pitMod + fatMod;
    S.pa.d20Final = total;

    const modStr = S.pa.d20Mod >= 0 ? `+${S.pa.d20Mod}` : `${S.pa.d20Mod}`;
    addLog(`🎲 Contact d20: <strong>${base}</strong> (${modStr}) = <strong>${total}</strong>`);

    // Determine category
    // Power A: 19 is auto HR
    const isPowerA = batter.power === 'A';

    if (total <= 2)  { S.pa.d20Category = 'k_swing'; }
    else if (total <= 4)  { S.pa.d20Category = 'k_look'; }
    else if (total <= 6)  { S.pa.d20Category = 'walk'; }
    else if (total === 7) { S.pa.d20Category = 'hbp'; }
    else if (total <= 10) { S.pa.d20Category = 'weak_grounder'; }
    else if (total <= 13) { S.pa.d20Category = 'line_drive'; }
    else if (total <= 16) { S.pa.d20Category = 'fly_ball'; }
    else if (total <= 18) { S.pa.d20Category = 'hard_grounder'; }
    else if (total === 19){ S.pa.d20Category = isPowerA ? 'home_run' : 'xbh'; }
    else                  { S.pa.d20Category = 'home_run'; }

    // Immediate resolutions (no more dice)
    switch (S.pa.d20Category) {
      case 'k_swing': resolveOut('Strikeout swinging ✖'); return;
      case 'k_look':  resolveOut('Strikeout looking ✖');  return;
      case 'walk':    resolveWalk(false); return;
      case 'hbp':     resolveWalk(true);  return;
      case 'home_run':resolveHomeRun();   return;
      case 'xbh':     S.step = 'roll_xbh';  render(); return;
      default:        S.step = 'roll_location'; render(); return;
    }
  }

  function stepRollLocation() {
    const d = roll(8);
    S.pa.d8Location = d;
    addLog(`🎲 Location d8: <strong>${d}</strong> — ${LOC_LABEL[d]}`);

    if (d === 1) {
      // Pitcher — auto out
      resolveOut(`Pitcher fields it — out at 1B ✖`);
      return;
    }

    // Check double play situation (grounder + runner on 1B + <2 outs)
    const isGrounder = ['weak_grounder', 'hard_grounder'].includes(S.pa.d20Category);
    S.pa.isDP = isGrounder && S.bases[0] !== null && S.outs < 2;

    S.step = 'roll_fielding';
    render();
  }

  function stepRollFielding() {
    const base = roll(6);
    const pos  = LOC_TO_POS[S.pa.d8Location];
    const fRating = getFielderRating(S.pa.d8Location);
    const fMod    = FIELDING_MOD[fRating] || 0;
    const final   = Math.min(6, Math.max(1, base + fMod));

    S.pa.d6Roll    = base;
    S.pa.d6Final   = final;

    const modStr = fMod >= 0 ? `+${fMod}` : `${fMod}`;
    addLog(`🎲 Fielding d6: <strong>${base}</strong> (${modStr}) = <strong>${final}</strong>`);

    if (S.pa.isDP) {
      resolveDoublePlay(final);
    } else {
      resolveFieldingCheck(final);
    }
  }

  function stepRollXBH() {
    const d = roll(4);
    S.pa.d4Roll = d;
    addLog(`🎲 XBH d4: <strong>${d}</strong>`);

    if (d <= 2)     resolveDouble();
    else if (d === 3) resolveTriple();
    else              resolveHomeRun();
  }

  function stepRollTagUp(runnerBaseIdx) {
    const runner  = S.bases[runnerBaseIdx];
    const d       = roll(6);
    const speed   = runner.speed || 'C';
    // Speed A: scores on 3+; Speed B: scores on 4+; Speed C: scores on 4+; Speed D: scores on 6 only
    const needed  = speed === 'A' ? 3 : speed === 'D' ? 6 : 4;
    const safe    = d >= needed;

    S.pa.tagUpRolls.push({ baseIdx: runnerBaseIdx, runner, roll: d, safe });
    addLog(`🎲 Tag-up d6 (${runnerName(runner)}): <strong>${d}</strong> — ${safe ? '✔ Advances' : '✖ Stays'}`);

    if (safe) {
      // Advance runner one base
      const nextBase = runnerBaseIdx + 1;
      if (nextBase >= 3) {
        // Scores
        S.score[S.half]++;
        S.inningRuns[S.half][S.inning - 1] = (S.inningRuns[S.half][S.inning - 1] || 0) + 1;
        addLog(`✅ ${runnerName(runner)} tags and scores!`);
      } else {
        S.bases[nextBase] = runner;
      }
      S.bases[runnerBaseIdx] = null;
    }

    S.pa.tagUpIdx++;
    if (S.pa.tagUpIdx < S.pa.tagUpQueue.length) {
      render(); // Show next tag-up
    } else {
      finishPA();
    }
  }

  /* ─────────────────────────────────────────
     RESOLUTIONS
  ───────────────────────────────────────── */

  function resolveOut(desc, runnerAdvance = false) {
    addLog(`✖ ${esc(currentBatter().name)}: ${desc}`);
    S.pa.result = desc;
    if (runnerAdvance) advanceRunnersOnOut();
    recordOut();
  }

  function resolveWalk(isHBP) {
    const label = isHBP ? 'Hit by Pitch — takes 1B' : 'Walk (Ball 4)';
    addLog(`✔ ${esc(currentBatter().name)}: ${label}`);
    S.pa.result = label;
    S.hits[S.half]; // walks don't count as hits
    // Place batter on 1B, advance forced runners
    advanceOnWalk();
    finishPA();
  }

  function resolveHomeRun() {
    addLog(`💥 ${esc(currentBatter().name)}: HOME RUN!`);
    S.pa.result = 'Home Run 💥';
    S.hits[S.half]++;
    let runs = 1; // batter scores
    [0, 1, 2].forEach(i => { if (S.bases[i]) { runs++; S.bases[i] = null; } });
    S.score[S.half] += runs;
    S.inningRuns[S.half][S.inning - 1] = (S.inningRuns[S.half][S.inning - 1] || 0) + runs;
    addLog(`✅ ${runs} run${runs !== 1 ? 's' : ''} score!`);
    S.bases = [null, null, null];
    finishPA();
  }

  function resolveDouble() {
    addLog(`✔ ${esc(currentBatter().name)}: Double!`);
    S.pa.result = 'Double';
    S.hits[S.half]++;
    advanceRunnersOnHit('double');
    S.bases[1] = currentBatter(); // batter to 2B
    finishPA();
  }

  function resolveTriple() {
    addLog(`✔ ${esc(currentBatter().name)}: Triple!`);
    S.pa.result = 'Triple';
    S.hits[S.half]++;
    advanceRunnersOnHit('triple');
    S.bases[2] = currentBatter(); // batter to 3B
    finishPA();
  }

  function resolveFieldingCheck(d6) {
    const isFlyBall = S.pa.d20Category === 'fly_ball';
    const isDeep    = S.pa.d8Location >= 5;

    switch (d6) {
      case 1: // Error
        S.errors[1 - S.half]++;
        addLog(`💢 Error! All safe — runners advance 1 extra base`);
        S.pa.result = 'Error';
        advanceRunnersOnHit('error');  // treat like a single + 1 extra
        S.bases[0] = currentBatter();
        finishPA();
        break;

      case 2:
      case 3: // Routine out — runners hold
        if (isFlyBall && isDeep) {
          // Deep fly — runners may tag up
          addLog(`✖ ${esc(currentBatter().name)}: Fly out (deep) — runners may tag`);
          S.pa.result = 'Fly out — tag-up opportunity';
          buildTagUpQueue();
          recordOut();
          return; // don't call finishPA yet — tag-ups handled separately
        }
        resolveOut('Routine out — runners hold');
        break;

      case 4: // Out, runners advance 1 (sac / FC)
        if (isFlyBall && isDeep) {
          addLog(`✖ ${esc(currentBatter().name)}: Fly out — runners may tag`);
          S.pa.result = 'Fly out — tag-up opportunity';
          buildTagUpQueue();
          recordOut();
          return;
        }
        addLog(`✖ ${esc(currentBatter().name)}: Out — runners advance 1`);
        S.pa.result = 'Out, runners advance 1';
        advanceRunnersOnOut();
        recordOut();
        break;

      case 5: // Single
        addLog(`✔ ${esc(currentBatter().name)}: Single!`);
        S.pa.result = 'Single';
        S.hits[S.half]++;
        advanceRunnersOnHit('single');
        S.bases[0] = currentBatter();
        finishPA();
        break;

      case 6: // Solid single — runners +1 extra base
        addLog(`✔ ${esc(currentBatter().name)}: Solid single!`);
        S.pa.result = 'Solid single';
        S.hits[S.half]++;
        advanceRunnersOnHit('solid_single');
        S.bases[0] = currentBatter();
        finishPA();
        break;
    }
  }

  function resolveDoublePlay(d6) {
    switch (true) {
      case d6 <= 2: // Error — all safe
        S.errors[1 - S.half]++;
        addLog(`💢 Error on potential DP! All safe`);
        S.pa.result = 'Error (DP attempt)';
        advanceRunnersOnHit('error');
        S.bases[0] = currentBatter();
        finishPA();
        break;

      case d6 <= 4: // Force out at 2B only
        addLog(`✖ Force out at 2B — batter safe at 1B`);
        S.pa.result = 'Force out at 2B';
        S.bases[1] = S.bases[0];  // runner advances to 2B
        S.bases[0] = currentBatter();
        recordOut();
        break;

      default: // 5-6: Double play
        addLog(`✖✖ Double play! ${esc(currentBatter().name)} + runner out`);
        S.pa.result = 'Double play';
        const dpRunner = S.bases[0];
        S.bases[0] = null;
        recordOut();
        if (S.outs < 3) {
          recordOut(); // second out
        }
        break;
    }
  }

  /* ─────────────────────────────────────────
     BASE RUNNING
  ───────────────────────────────────────── */

  function advanceOnWalk() {
    // Force runners only if occupied — from 3B to 2B to 1B
    if (S.bases[0] && S.bases[1] && S.bases[2]) {
      // Bases loaded — everyone advances
      S.score[S.half]++;
      S.inningRuns[S.half][S.inning - 1] = (S.inningRuns[S.half][S.inning - 1] || 0) + 1;
      addLog(`✅ Forced run scores!`);
    } else if (S.bases[0] && S.bases[1]) {
      S.bases[2] = S.bases[1]; // runner on 2B → 3B
      S.bases[1] = S.bases[0]; // runner on 1B → 2B
    } else if (S.bases[0]) {
      S.bases[1] = S.bases[0]; // runner on 1B → 2B
    }
    S.bases[0] = currentBatter();
  }

  function advanceRunnersOnHit(type) {
    let newBases = [null, null, null];
    let runsScored = 0;

    const score3B = () => {
      if (S.bases[2]) { runsScored++; S.bases[2] = null; }
    };
    const score2B = () => {
      if (S.bases[1]) { runsScored++; S.bases[1] = null; }
    };
    const move1Bto3B = () => {
      if (S.bases[0]) newBases[2] = S.bases[0];
    };
    const move1Bto2B = () => {
      if (S.bases[0]) newBases[1] = S.bases[0];
    };
    const move2Bto3B = () => {
      if (S.bases[1]) newBases[2] = S.bases[1];
    };

    switch (type) {
      case 'single': {
        score3B();
        score2B();
        const batter = currentBatter();
        const speed  = batter.speed || 'C';
        if (speed === 'A') {
          // Speed A: advances 2 bases from 1B (scores from 1B)
          if (S.bases[0]) { runsScored++; } // runner on 1B scores
        } else if (speed === 'B') {
          // Speed B: advance 1 extra from 1B → 3B
          move1Bto3B();
        } else {
          // Speed C/D: 1B → 3B is default per table; Speed D goes to 2B
          if (speed === 'D') { move1Bto2B(); } else { move1Bto3B(); }
        }
        break;
      }
      case 'solid_single': {
        // Same as single + 1 extra base for all runners
        score3B();
        score2B();
        const batter2 = currentBatter();
        const spd2    = batter2.speed || 'C';
        if (spd2 === 'A' || spd2 === 'B') {
          if (S.bases[0]) runsScored++;
        } else {
          // All move 2 bases: 1B → 3B is +1 extra on top of normal
          if (S.bases[0]) runsScored++; // 1B scores on solid single
        }
        break;
      }
      case 'double': {
        score3B();
        score2B();
        move1Bto3B();
        break;
      }
      case 'triple': {
        [0, 1, 2].forEach(i => { if (S.bases[i]) runsScored++; });
        newBases = [null, null, null];
        break;
      }
      case 'error': {
        // Error: all safe, runners advance 1 extra base (like solid single)
        score3B();
        if (S.bases[1]) newBases[2] = S.bases[1]; // 2B → 3B
        if (S.bases[0]) newBases[1] = S.bases[0]; // 1B → 2B
        break;
      }
    }

    S.bases = newBases;
    if (runsScored > 0) {
      S.score[S.half] += runsScored;
      S.inningRuns[S.half][S.inning - 1] = (S.inningRuns[S.half][S.inning - 1] || 0) + runsScored;
      addLog(`✅ ${runsScored} run${runsScored !== 1 ? 's' : ''} score!`);
    }
  }

  function advanceRunnersOnOut() {
    // Sac fly / FC: runners advance 1 base
    let runsScored = 0;
    const newBases = [null, null, null];
    if (S.bases[2]) { runsScored++; }
    if (S.bases[1]) newBases[2] = S.bases[1];
    if (S.bases[0]) newBases[1] = S.bases[0];
    S.bases = newBases;
    if (runsScored > 0) {
      S.score[S.half] += runsScored;
      S.inningRuns[S.half][S.inning - 1] = (S.inningRuns[S.half][S.inning - 1] || 0) + runsScored;
      addLog(`✅ Runner scores on the play!`);
    }
  }

  /* ─────────────────────────────────────────
     TAG-UP
  ───────────────────────────────────────── */

  function buildTagUpQueue() {
    S.pa.tagUpQueue = [];
    // Any occupied base can attempt to tag (we roll for each)
    for (let i = 2; i >= 0; i--) {
      if (S.bases[i]) S.pa.tagUpQueue.push(i);
    }
    S.pa.tagUpIdx = 0;
    if (S.pa.tagUpQueue.length > 0) {
      S.step = 'roll_tagup';
    } else {
      finishPA();
    }
    render();
  }

  /* ─────────────────────────────────────────
     OUTS & INNING TRANSITIONS
  ───────────────────────────────────────── */

  function recordOut() {
    S.outs++;
    const pitcher = currentPitcher();
    if (!pitcher._halfsPitched) pitcher._halfsPitched = 0;

    if (S.outs >= 3) {
      endHalfInning();
    } else {
      nextBatter();
      if (S.step !== 'half_over' && S.step !== 'game_over') {
        S.step = 'pre_pa';
      }
      render();
    }
  }

  function finishPA() {
    nextBatter();
    if (S.step !== 'half_over' && S.step !== 'game_over') {
      S.step = 'pre_pa';
    }
    render();
  }

  function nextBatter() {
    const ti = S.half;
    S.batterIdx[ti] = (S.batterIdx[ti] + 1) % 9;
    S.pa = freshPA();
  }

  function endHalfInning() {
    // Record the half-inning for the pitcher
    const pitcher = currentPitcher();
    if (pitcher) {
      if (!pitcher._halfsPitched) pitcher._halfsPitched = 0;
      pitcher._halfsPitched++;
    }

    // Ensure inning box has a value (0 if no runs scored)
    if (S.inningRuns[S.half][S.inning - 1] === null) {
      S.inningRuns[S.half][S.inning - 1] = 0;
    }

    const prevHalf = S.half;
    const prevInning = S.inning;

    if (S.half === 0) {
      // End of top half → start bottom half
      S.half = 1;
      S.step = 'roll_fatigue';
      S.fatigueRolled = false;
      S.fatigueMod = 0;
      S.outs = 0;
      S.bases = [null, null, null];
      S.pa = freshPA();

      addLog(`<em>◀ End of top of ${prevInning} — score: ${esc(S.teams[0].name)} ${S.score[0]}, ${esc(S.teams[1].name)} ${S.score[1]}</em>`);
      // Check pitcher change
      if (checkPitcherChange()) advancePitcher();
      logHalfInningStart();

      // Extra innings ghost runner
      if (S.inning > 9) {
        S.bases[1] = { name: 'Ghost Runner', ghost: true, speed: 'B' };
        addLog(`👻 Ghost runner placed on 2B`);
      }
    } else {
      // End of bottom half → end of inning
      addLog(`<em>◀ End of ${prevInning} — score: ${esc(S.teams[0].name)} ${S.score[0]}, ${esc(S.teams[1].name)} ${S.score[1]}</em>`);

      // Check for walk-off (home team wins mid-inning, score > visitor)
      if (S.inning >= 9 && S.score[1] > S.score[0]) {
        endGame();
        return;
      }

      // Check game over (9 innings, or extra if not tied)
      if (S.inning >= 9) {
        if (S.score[0] !== S.score[1]) {
          endGame();
          return;
        }
        // Tied → extra innings
        S.extraInnings = true;
        addLog(`<em>⚾ Tied after ${S.inning} — Extra innings!</em>`);
      }

      S.inning++;
      S.half = 0;
      S.step = 'roll_fatigue';
      S.fatigueRolled = false;
      S.fatigueMod = 0;
      S.outs = 0;
      S.bases = [null, null, null];
      S.pa = freshPA();

      // Check pitcher changes for both teams
      if (checkPitcherChange()) advancePitcher();

      // Extra innings ghost runner
      if (S.extraInnings) {
        S.bases[1] = { name: 'Ghost Runner', ghost: true, speed: 'B' };
        addLog(`👻 Ghost runner placed on 2B`);
      }

      logHalfInningStart();
    }

    S.step = 'roll_fatigue';
    render();
  }

  function endGame() {
    S.step = 'game_over';
    S.gameOver = true;
    const winner = S.score[0] > S.score[1] ? S.teams[0].name : S.teams[1].name;
    addLog(`<strong>🏆 Final: ${esc(S.teams[0].name)} ${S.score[0]}, ${esc(S.teams[1].name)} ${S.score[1]}</strong>`);
    addLog(`<strong>🎉 ${esc(winner)} wins!</strong>`);
    render();
  }

  /* ─────────────────────────────────────────
     SPECIAL PLAYS
  ───────────────────────────────────────── */

  function attemptSteal(runnerBase) {
    const runner = S.bases[runnerBase];
    if (!runner || runner.ghost) return;
    const speed = runner.speed || 'C';
    if (speed !== 'A' && speed !== 'B') return;

    const d = roll(6);
    const needed = speed === 'A' ? 2 : 3;
    const safe   = d >= needed;

    addLog(`🎲 Steal attempt (${runnerName(runner)}): d6 = <strong>${d}</strong> — ${safe ? '✔ Safe!' : '✖ Caught stealing!'}`);

    if (safe) {
      S.bases[runnerBase + 1] = runner;
    } else {
      recordOut();
      if (S.step === 'half_over' || S.step === 'game_over') return;
    }
    S.bases[runnerBase] = null;
    S.step = 'pre_pa';
    render();
  }

  function attemptBunt() {
    if (S.outs >= 2) return;
    const d = roll(6);
    addLog(`🎲 Sacrifice bunt: d6 = <strong>${d}</strong>`);

    if (d === 1) {
      addLog(`✖ Foul ball — strike!`);
      // Just a strike — no PA change, step back to pre_pa
    } else if (d === 2) {
      addLog(`✖ Popped up — out, no advance`);
      recordOut();
      return;
    } else {
      addLog(`✔ Bunt successful — batter out, lead runner advances`);
      advanceRunnersOnOut();
      recordOut();
      return;
    }
    S.step = 'pre_pa';
    render();
  }

  /* ─────────────────────────────────────────
     ANIMATION
  ───────────────────────────────────────── */

  function animateDie(sides, elId, callback) {
    if (S.rolling) return;
    S.rolling = true;
    const el = document.getElementById(elId);
    if (!el) { S.rolling = false; callback(); return; }

    let count = 0;
    const interval = setInterval(() => {
      el.textContent = Math.floor(Math.random() * sides) + 1;
      el.classList.add('die-rolling');
      count++;
      if (count >= 8) {
        clearInterval(interval);
        el.classList.remove('die-rolling');
        S.rolling = false;
        callback();
      }
    }, 60);
  }

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */

  function render() {
    const root = document.getElementById('game-root');
    if (!root) return;
    root.innerHTML = buildGameHTML();
    bindEvents();
  }

  function buildGameHTML() {
    return `
      <div class="game-container">
        ${buildScoreboard()}
        <div class="game-main">
          ${buildRosterPanel(0)}
          <div class="game-left">
            ${buildDiamond()}
            ${buildSituation()}
          </div>
          <div class="game-right">
            ${buildActionArea()}
          </div>
          ${buildRosterPanel(1)}
        </div>
        ${buildPlayLog()}
      </div>`;
  }

  /* ── Roster Side Panel ── */
  function buildRosterPanel(teamIdx) {
    const team       = S.teams[teamIdx];
    const isBatting  = S.half === teamIdx;
    const curBatIdx  = S.batterIdx[teamIdx];
    const curPitIdx  = S.pitcherIdx[teamIdx];  // this team's current pitcher

    // Use last name to fit the narrow column
    const lastName = name => {
      const parts = name.split(' ');
      return parts.length > 1 ? parts.slice(1).join(' ') : name;
    };

    const batterRows = team.battingOrder.map((player, i) => {
      if (!player) {
        return `<div class="gr-row gr-empty"><span class="gr-num">${i + 1}</span><span class="gr-name">—</span></div>`;
      }
      const isUp   = isBatting && i === curBatIdx;
      const onDeck = isBatting && i === (curBatIdx + 1) % 9;
      const pos    = player.positions ? player.positions[0] : '';
      return `
        <div class="gr-row ${isUp ? 'gr-current' : onDeck ? 'gr-on-deck' : ''}">
          <span class="gr-num">${i + 1}</span>
          <span class="gr-name">${esc(lastName(player.name))}</span>
          <span class="gr-meta">
            ${pos ? `<span class="gr-pos">${pos}</span>` : ''}
            <span class="gr-rating">${player.contact}</span>
          </span>
        </div>`;
    }).join('');

    const pitcherRows = team.pitchingOrder.map((p, i) => {
      const isPitching = !isBatting && i === curPitIdx;
      const hps = p._halfsPitched || 0;
      const maxInn = STAMINA_INNINGS[p.stamina] || 5;
      const fatBar = !isBatting && isPitching
        ? `<span class="gr-stamina" title="${hps} halfs pitched">${'●'.repeat(Math.min(hps, 6))}${'○'.repeat(Math.max(0, 6 - hps))}</span>`
        : '';
      return `
        <div class="gr-row gr-pitcher-row ${isPitching ? 'gr-pitching' : ''}">
          <span class="gr-num">${i === 0 ? 'SP' : 'RP'}</span>
          <span class="gr-name">${esc(lastName(p.name))}</span>
          <span class="gr-meta">
            <span class="gr-rating">${p.pitching}</span>
            ${fatBar}
          </span>
        </div>`;
    }).join('');

    const side = teamIdx === 0 ? 'left' : 'right';
    return `
      <div class="game-roster game-roster--${side}">
        <div class="gr-header ${isBatting ? 'gr-header--batting' : ''}">
          <span class="gr-team">${esc(team.name)}</span>
          <span class="gr-score-badge">${S.score[teamIdx]}</span>
        </div>
        <div class="gr-section">
          <div class="gr-section-label">Batting Order ${isBatting ? '<span class="gr-batting-dot"></span>' : ''}</div>
          <div class="gr-list">${batterRows}</div>
        </div>
        <div class="gr-divider"></div>
        <div class="gr-section">
          <div class="gr-section-label">Pitching</div>
          <div class="gr-list">${pitcherRows}</div>
        </div>
      </div>`;
  }

  /* ── Scoreboard ── */
  function buildScoreboard() {
    const innings = Math.max(9, S.inning);
    const headers = Array.from({length: innings}, (_, i) => `<th>${i + 1}</th>`).join('');

    const teamRow = (ti) => {
      const cells = Array.from({length: innings}, (_, i) => {
        const val = S.inningRuns[ti][i];
        const isCurrent = (i + 1 === S.inning) && (ti === S.half);
        return `<td class="${isCurrent ? 'current-inning' : ''}">${val !== null ? val : ''}</td>`;
      }).join('');
      return `
        <tr>
          <td class="sb-team ${S.half === ti ? 'batting' : ''}">${esc(S.teams[ti].name)}</td>
          ${cells}
          <td class="sb-r">${S.score[ti]}</td>
          <td class="sb-rhe">${S.hits[ti]}</td>
          <td class="sb-rhe">${S.errors[ti]}</td>
        </tr>`;
    };

    return `
      <div class="scoreboard-wrap">
        <table class="scoreboard">
          <thead>
            <tr>
              <th class="sb-team-hdr">Team</th>
              ${headers}
              <th class="sb-r">R</th>
              <th class="sb-rhe">H</th>
              <th class="sb-rhe">E</th>
            </tr>
          </thead>
          <tbody>
            ${teamRow(0)}
            ${teamRow(1)}
          </tbody>
        </table>
      </div>`;
  }

  /* ── Diamond ── */
  function buildDiamond() {
    const b1 = S.bases[0], b2 = S.bases[1], b3 = S.bases[2];
    const baseHtml = (runner, label, cls) => `
      <div class="base ${cls} ${runner ? 'occupied' : ''}">
        ${runner ? `<span class="runner-name">${esc(runnerName(runner))}</span>` : ''}
        <span class="base-label">${label}</span>
      </div>`;

    const outsHtml = Array.from({length: 3}, (_, i) =>
      `<div class="out-dot ${i < S.outs ? 'recorded' : ''}"></div>`
    ).join('');

    return `
      <div class="diamond-wrap">
        <div class="diamond-field">
          <div class="field-bg"></div>
          ${baseHtml(b2, '2B', 'base-2b')}
          ${baseHtml(b3, '3B', 'base-3b')}
          ${baseHtml(b1, '1B', 'base-1b')}
          <div class="base home-plate"><span class="base-label">HP</span></div>
          <div class="base-paths">
            <div class="path path-1b-2b"></div>
            <div class="path path-2b-3b"></div>
            <div class="path path-3b-hp"></div>
            <div class="path path-hp-1b"></div>
          </div>
        </div>
        <div class="outs-row">
          <span class="outs-label">Outs:</span>
          ${outsHtml}
        </div>
      </div>`;
  }

  /* ── Situation ── */
  function buildSituation() {
    const batter  = currentBatter();
    const pitcher = currentPitcher();
    const half    = S.half === 0 ? '▲' : '▼';
    const ord     = S.inning <= 9
      ? ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][S.inning - 1]
      : `${S.inning}th`;

    const batterAttrs = batter
      ? `CON <strong>${batter.contact}</strong> · PWR <strong>${batter.power}</strong> · SPD <strong>${batter.speed}</strong>`
      : '—';
    const pitcherAttrs = pitcher
      ? `PIT <strong>${pitcher.pitching}</strong> · ${STAMINA_LABELS[pitcher.stamina]}`
      : '—';

    return `
      <div class="situation-panel">
        <div class="inning-badge">${half} ${ord}</div>
        <div class="matchup">
          <div class="matchup-row">
            <span class="matchup-label">AB</span>
            <span class="matchup-name">${batter ? esc(batter.name) : '—'}</span>
            <span class="matchup-attrs">${batterAttrs}</span>
          </div>
          <div class="matchup-row">
            <span class="matchup-label">P</span>
            <span class="matchup-name">${pitcher ? esc(pitcher.name) : '—'}</span>
            <span class="matchup-attrs">${pitcherAttrs}</span>
          </div>
        </div>
        ${S.fatigueMod !== 0 ? `<div class="fatigue-badge">Fatigue modifier: ${S.fatigueMod > 0 ? '+' : ''}${S.fatigueMod}</div>` : ''}
      </div>`;
  }

  /* ── Action area (step-based) ── */
  function buildActionArea() {
    if (S.gameOver) return buildGameOverPanel();

    switch (S.step) {
      case 'roll_fatigue':   return buildRollPanel('Roll Fatigue Die', 'd12', 12, 'btn-roll-fatigue',
        'Roll the d12 to determine pitcher fatigue for this half-inning.');

      case 'pre_pa':         return buildPrePAPanel();

      case 'roll_contact':   return buildRollPanel('Roll Contact Die', 'd20', 20, 'btn-roll-contact',
        'Roll the d20 Contact roll. Modifiers applied automatically.');

      case 'roll_location':  return buildRollPanel('Roll Hit Location', 'd8', 8, 'btn-roll-location',
        `${d20ResultLabel(S.pa.d20Category)} — Roll d8 to see where it goes.`);

      case 'roll_fielding':  return buildRollPanel('Roll Fielding Check', 'd6', 6, 'btn-roll-fielding',
        `Ball to ${LOC_LABEL[S.pa.d8Location]} — Roll d6 fielding check.`);

      case 'roll_xbh':       return buildRollPanel('Roll Extra-Base Hit', 'd4', 4, 'btn-roll-xbh',
        'Extra-base hit! Roll d4: 1-2 = Double, 3 = Triple, 4 = HR.');

      case 'roll_tagup': {
        const baseIdx = S.pa.tagUpQueue[S.pa.tagUpIdx];
        const runner  = S.bases[baseIdx] || S.pa.tagUpRolls[S.pa.tagUpIdx - 1]?.runner;
        return buildRollPanel('Tag-Up Attempt', 'd6', 6, 'btn-roll-tagup',
          `${runner ? esc(runnerName(runner)) : 'Runner'} attempting to tag and advance.`);
      }

      default: return `<div class="action-panel"><p style="color:#888">Resolving…</p></div>`;
    }
  }

  function buildRollPanel(title, dieLabel, sides, btnId, hint) {
    return `
      <div class="action-panel">
        <div class="action-title">${title}</div>
        <div class="die-display">
          <div class="die die-${sides}" id="die-face">?</div>
          <div class="die-label">${dieLabel}</div>
        </div>
        <p class="action-hint">${hint}</p>
        <button class="btn btn-roll" id="${btnId}" data-sides="${sides}">
          Roll ${dieLabel} 🎲
        </button>
      </div>`;
  }

  function buildPrePAPanel() {
    const batter  = currentBatter();
    const pitcher = currentPitcher();
    if (!batter || !pitcher) return '<div class="action-panel">…</div>';

    const conMod = CONTACT_MOD[batter.contact] || 0;
    const pitMod = PITCHING_MOD[pitcher.pitching] || 0;
    const netMod = conMod + pitMod + S.fatigueMod;
    const netStr = netMod >= 0 ? `+${netMod}` : `${netMod}`;

    // Steal candidates — only show if the target base is unoccupied
    let stealBtns = '';
    [0, 1].forEach(baseIdx => {
      const runner   = S.bases[baseIdx];
      const nextBase = S.bases[baseIdx + 1];  // must be empty to steal
      if (runner && !runner.ghost && (runner.speed === 'A' || runner.speed === 'B') && !nextBase) {
        const nextLabel = ['2B','3B'][baseIdx];
        stealBtns += `<button class="btn btn-secondary steal-btn" data-base="${baseIdx}">
          Steal ${nextLabel} — ${esc(runnerName(runner))}
        </button>`;
      }
    });

    const buntBtn = S.outs < 2
      ? `<button class="btn btn-secondary" id="btn-bunt">Sacrifice Bunt</button>`
      : '';

    return `
      <div class="action-panel">
        <div class="action-title">At the Plate</div>
        <div class="modifier-row">
          <span>Net d20 modifier:</span>
          <strong class="${netMod > 0 ? 'mod-pos' : netMod < 0 ? 'mod-neg' : ''}">${netStr}</strong>
        </div>
        <div class="modifier-breakdown">
          CON ${batter.contact} (${conMod >= 0 ? '+' : ''}${conMod}) ·
          PIT ${pitcher.pitching} (${pitMod >= 0 ? '+' : ''}${pitMod}) ·
          Fatigue (${S.fatigueMod >= 0 ? '+' : ''}${S.fatigueMod})
        </div>
        <button class="btn btn-roll" id="btn-roll-contact">Roll d20 🎲</button>
        ${stealBtns ? `<div class="special-btns">${stealBtns}</div>` : ''}
        ${buntBtn ? `<div class="special-btns">${buntBtn}</div>` : ''}
      </div>`;
  }

  function buildGameOverPanel() {
    const winner = S.score[0] > S.score[1] ? S.teams[0] : S.teams[1];
    return `
      <div class="action-panel game-over-panel">
        <div class="game-over-title">🏆 Final Score</div>
        <div class="game-over-score">
          <div>${esc(S.teams[0].name)}: <strong>${S.score[0]}</strong></div>
          <div>${esc(S.teams[1].name)}: <strong>${S.score[1]}</strong></div>
        </div>
        <div class="game-over-winner">🎉 ${esc(winner.name)} wins!</div>
      </div>`;
  }

  function d20ResultLabel(cat) {
    const labels = {
      weak_grounder: 'Weak grounder',  hard_grounder: 'Hard grounder',
      line_drive:    'Line drive',      fly_ball:      'Fly ball',
    };
    return labels[cat] || cat || '';
  }

  /* ── Play log ── */
  function buildPlayLog() {
    const entries = S.log.slice(0, 20).map(e => `<div class="log-entry">${e}</div>`).join('');
    return `
      <div class="play-log">
        <div class="play-log-header">Play Log</div>
        <div class="log-entries">${entries}</div>
      </div>`;
  }

  /* ─────────────────────────────────────────
     EVENT BINDING
  ───────────────────────────────────────── */

  function bindEvents() {
    // Fatigue roll
    document.getElementById('btn-roll-fatigue')?.addEventListener('click', () => {
      animateDie(12, 'die-face', () => stepRollFatigue());
    });

    // Contact roll (from pre_pa or roll_contact step)
    document.getElementById('btn-roll-contact')?.addEventListener('click', () => {
      S.step = 'roll_contact';
      animateDie(20, 'die-face', () => stepRollContact());
    });

    document.getElementById('btn-roll-location')?.addEventListener('click', () => {
      animateDie(8, 'die-face', () => stepRollLocation());
    });

    document.getElementById('btn-roll-fielding')?.addEventListener('click', () => {
      animateDie(6, 'die-face', () => stepRollFielding());
    });

    document.getElementById('btn-roll-xbh')?.addEventListener('click', () => {
      animateDie(4, 'die-face', () => stepRollXBH());
    });

    document.getElementById('btn-roll-tagup')?.addEventListener('click', () => {
      const baseIdx = S.pa.tagUpQueue[S.pa.tagUpIdx];
      animateDie(6, 'die-face', () => stepRollTagUp(baseIdx));
    });

    // Steal buttons
    document.querySelectorAll('.steal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const base = parseInt(btn.dataset.base, 10);
        attemptSteal(base);
      });
    });

    // Bunt
    document.getElementById('btn-bunt')?.addEventListener('click', () => {
      animateDie(6, 'die-face', () => attemptBunt());
    });
  }

  /* ─────────────────────────────────────────
     PUBLIC
  ───────────────────────────────────────── */
  return { init };

})();
