/* ═══════════════════════════════════════════
   Diamond Dice — Draft Logic
   Handles: pool building, alternating draft picks, lineup setting
═══════════════════════════════════════════ */

'use strict';

const Draft = (() => {

  /* ─────────────────────────────────────────
     POOL BUILDING
  ───────────────────────────────────────── */

  function addPlayerToPool(formData) {
    const { name, type, positions, contact, power, speed, fielding, pitching, stamina } = formData;
    if (!name.trim()) return { ok: false, error: 'Name is required.' };

    const isBatter  = type === 'batter'  || type === 'twoway';
    const isPitcher = type === 'pitcher' || type === 'twoway';

    // Validate positions for batters/two-way
    if (isBatter && (!positions || positions.length === 0)) {
      return { ok: false, error: 'Select at least one position.' };
    }

    const player = {
      id:   AppState.newId(),
      name: name.trim(),
      type, // 'batter' | 'pitcher' | 'twoway'
    };

    if (isBatter) {
      player.positions = positions; // array e.g. ['SS', '2B']
      player.contact   = contact  || 'B';
      player.power     = power    || 'B';
      player.speed     = speed    || 'B';
      player.fielding  = fielding || 'B';
    }

    if (isPitcher) {
      player.pitching = pitching || 'B';
      player.stamina  = stamina  || 'midsp';
    }

    AppState.pool.push(player);
    return { ok: true, player };
  }

  function removePlayerFromPool(playerId) {
    const idx = AppState.pool.findIndex(p => p.id === playerId);
    if (idx === -1) return false;
    AppState.pool.splice(idx, 1);
    return true;
  }

  /* ─────────────────────────────────────────
     DRAFT PICKS
  ───────────────────────────────────────── */

  let _selectedPlayerId = null;

  function getSelectedPlayer() {
    if (_selectedPlayerId === null) return null;
    return AppState.pool.find(p => p.id === _selectedPlayerId) || null;
  }

  function selectPlayer(playerId) {
    const teamIdx = AppState.currentDraftTeam();
    const player  = AppState.pool.find(p => p.id === playerId);
    if (!player) return false;
    if (!AppState.canPickType(teamIdx, player.type)) return false;

    _selectedPlayerId = (_selectedPlayerId === playerId) ? null : playerId;
    return true;
  }

  function confirmPick() {
    if (_selectedPlayerId === null) return false;
    const teamIdx = AppState.currentDraftTeam();
    const player  = AppState.pool.find(p => p.id === _selectedPlayerId);
    if (!player) return false;
    if (!AppState.canPickType(teamIdx, player.type)) return false;

    const team = AppState.teams[teamIdx];

    // Two-way players fill BOTH a batter slot AND a pitcher slot
    if (player.type === 'twoway') {
      team.batters.push(player);
      team.pitchers.push(player);
    } else if (player.type === 'batter') {
      team.batters.push(player);
    } else if (player.type === 'pitcher') {
      team.pitchers.push(player);
    }

    AppState.draftPicks.push({
      pickNum:  AppState.currentPickNum,
      teamIdx,
      player,
    });

    AppState.currentPickNum++;
    _selectedPlayerId = null;

    if (AppState.bothRosterMinMet()) {
      AppState.draftComplete = true;
    }

    return true;
  }

  function isDraftComplete() {
    return AppState.draftComplete;
  }

  function canCurrentTeamPick(playerType) {
    return AppState.canPickType(AppState.currentDraftTeam(), playerType);
  }

  /* ─────────────────────────────────────────
     LINEUP SETTING
  ───────────────────────────────────────── */

  function assignBatterToSlot(teamIdx, playerObj, slotIdx) {
    const team = AppState.teams[teamIdx];
    if (slotIdx < 0 || slotIdx >= 9) return false;

    // Remove from any existing slot first
    const existingSlot = team.battingOrder.findIndex(p => p && p.id === playerObj.id);
    if (existingSlot !== -1) team.battingOrder[existingSlot] = null;

    team.battingOrder[slotIdx] = playerObj;
    return true;
  }

  function removeFromBattingOrder(teamIdx, slotIdx) {
    AppState.teams[teamIdx].battingOrder[slotIdx] = null;
  }

  function setPitchingOrder(teamIdx, orderedPitchers) {
    AppState.teams[teamIdx].pitchingOrder = orderedPitchers;
  }

  function battingOrderComplete(teamIdx) {
    return AppState.teams[teamIdx].battingOrder.every(p => p !== null);
  }

  function pitchingOrderComplete(teamIdx) {
    const team = AppState.teams[teamIdx];
    if (!team.pitchingOrder.length) return false;
    return team.pitchingOrder.some(p => STAMINA_IS_STARTER[p.stamina]);
  }

  // Returns the Set of positions covered by the current batting order slots
  function battingOrderCoverage(teamIdx) {
    const covered = new Set();
    AppState.teams[teamIdx].battingOrder.forEach(p => {
      if (p) (p.positions || []).forEach(pos => covered.add(pos));
    });
    return covered;
  }

  // Returns required positions missing from the current batting order
  function battingOrderMissingPositions(teamIdx) {
    const covered = battingOrderCoverage(teamIdx);
    return POSITIONS_REQUIRED.filter(pos => !covered.has(pos));
  }

  function lineupComplete(teamIdx) {
    if (!battingOrderComplete(teamIdx))  return false;
    if (!pitchingOrderComplete(teamIdx)) return false;
    // All 8 required field positions must be covered by the batting order
    return battingOrderMissingPositions(teamIdx).length === 0;
  }

  function unassignedBatters(teamIdx) {
    const team = AppState.teams[teamIdx];
    const assigned = new Set(team.battingOrder.filter(Boolean).map(p => p.id));
    return team.batters.filter(p => !assigned.has(p.id));
  }

  /* ─────────────────────────────────────────
     AUTO-DRAFT & AUTO-LINEUP (testing helpers)
  ───────────────────────────────────────── */

  const _ratingScore = { A: 4, B: 3, C: 2, D: 1 };

  function _playerScore(p) {
    let s = 0;
    if (p.type === 'batter'  || p.type === 'twoway')
      s += (_ratingScore[p.contact]  || 2) + (_ratingScore[p.power]    || 2)
         + (_ratingScore[p.speed]    || 2) + (_ratingScore[p.fielding] || 2);
    if (p.type === 'pitcher' || p.type === 'twoway')
      s += (_ratingScore[p.pitching] || 2) * 2;
    return s;
  }

  // Simulate all remaining draft picks with a priority-based greedy algorithm.
  function autoDraft() {
    let guard = 0;
    while (!AppState.draftComplete && guard++ < 300) {
      const teamIdx   = AppState.currentDraftTeam();
      const available = AppState.availablePool();
      if (!available.length) break;

      const needsBatters  = AppState.canPickType(teamIdx, 'batter');
      const needsPitchers = AppState.canPickType(teamIdx, 'pitcher');
      const pitcherCount  = AppState.teamPitcherCount(teamIdx);
      const missingPos    = AppState.positionsNeeded(teamIdx);

      let pick = null;

      // Priority 1 – urgently need pitchers (< 3)
      if (!pick && needsPitchers && pitcherCount < 3) {
        const opts = available
          .filter(p => AppState.canPickType(teamIdx, p.type) &&
                       (p.type === 'pitcher' || p.type === 'twoway'))
          .sort((a, b) => _playerScore(b) - _playerScore(a));
        if (opts.length) pick = opts[0];
      }

      // Priority 2 – fill a missing field position
      if (!pick && needsBatters && missingPos.length > 0) {
        const opts = available
          .filter(p => AppState.canPickType(teamIdx, p.type) &&
                       (p.type === 'batter' || p.type === 'twoway') &&
                       (p.positions || []).some(pos => missingPos.includes(pos)))
          .sort((a, b) => {
            const aC = (a.positions || []).filter(pos => missingPos.includes(pos)).length;
            const bC = (b.positions || []).filter(pos => missingPos.includes(pos)).length;
            return bC !== aC ? bC - aC : _playerScore(b) - _playerScore(a);
          });
        if (opts.length) pick = opts[0];
      }

      // Priority 3 – best available batter
      if (!pick && needsBatters) {
        const opts = available
          .filter(p => AppState.canPickType(teamIdx, p.type) &&
                       (p.type === 'batter' || p.type === 'twoway'))
          .sort((a, b) => _playerScore(b) - _playerScore(a));
        if (opts.length) pick = opts[0];
      }

      // Priority 4 – 4th pitcher slot
      if (!pick && needsPitchers) {
        const opts = available
          .filter(p => AppState.canPickType(teamIdx, p.type) &&
                       (p.type === 'pitcher' || p.type === 'twoway'))
          .sort((a, b) => _playerScore(b) - _playerScore(a));
        if (opts.length) pick = opts[0];
      }

      if (!pick) break;
      _selectedPlayerId = pick.id;
      confirmPick();
    }
  }

  // Automatically build the batting order and pitching staff for a team.
  // Chooses the weakest player who can safely sit the bench (i.e., their
  // positions are still covered by the remaining 9), then assigns the rest
  // to slots 1–9 sorted by overall score.
  function autoSetLineup(teamIdx) {
    const team    = AppState.teams[teamIdx];
    const batters = [...team.batters];

    function batterScore(p) {
      return (_ratingScore[p.contact]  || 2) + (_ratingScore[p.power]    || 2)
           + (_ratingScore[p.speed]    || 2) + (_ratingScore[p.fielding] || 2);
    }

    // Find best bench candidate: lowest score whose removal still covers all positions
    const sortedAsc = [...batters].sort((a, b) => batterScore(a) - batterScore(b));
    let benchPlayer = null;
    for (const candidate of sortedAsc) {
      const rest = batters.filter(p => p.id !== candidate.id);
      const covered = new Set();
      rest.forEach(p => (p.positions || []).forEach(pos => covered.add(pos)));
      if (POSITIONS_REQUIRED.every(pos => covered.has(pos))) {
        benchPlayer = candidate;
        break;
      }
    }
    // Fallback: bench the lowest-scoring player regardless
    if (!benchPlayer) benchPlayer = sortedAsc[0];

    // Reset and fill batting order (slots 0–8) with the remaining 9 batters
    team.battingOrder = new Array(9).fill(null);
    batters
      .filter(p => p.id !== benchPlayer.id)
      .sort((a, b) => batterScore(b) - batterScore(a))
      .forEach((p, i) => { team.battingOrder[i] = p; });

    // Set pitching order: ace → midsp → longrp → closer
    const staminaOrder = { ace: 0, midsp: 1, longrp: 2, closer: 3 };
    team.pitchingOrder = [...team.pitchers].sort(
      (a, b) => (staminaOrder[a.stamina] ?? 2) - (staminaOrder[b.stamina] ?? 2)
    );
  }

  /* ─────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────── */
  return {
    addPlayerToPool,
    removePlayerFromPool,
    selectPlayer,
    getSelectedPlayer,
    confirmPick,
    isDraftComplete,
    canCurrentTeamPick,
    assignBatterToSlot,
    removeFromBattingOrder,
    setPitchingOrder,
    battingOrderComplete,
    pitchingOrderComplete,
    battingOrderCoverage,
    battingOrderMissingPositions,
    lineupComplete,
    unassignedBatters,
    autoDraft,
    autoSetLineup,
  };

})();
