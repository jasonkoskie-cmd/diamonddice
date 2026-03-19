/* âââââââââââââââââââââââââââââââââââââââââââ
   Diamond Dice ââ Shared State & Constants
âââââââââââââââââââââââââââââââââââââââââââ 
'use strict';

/* ââ Rating constants ââ */
const RATINGS = ['A', 'B', 'C', 'D'];

const STAMINA_LABELS = {
  ace:    'Ace (7 inn)',
  midsp:  'Mid SP (5 inn)',
  longrp: 'Long RP (3 inn)',
  closer: 'Closer (1 inn)',
};

const STAMINA_INNINGS = {
  ace: 7, midsp: 5, longrp: 3, closer: 1
};

const STAMINA_IS_STARTER = {
  ace: true, midsp: true, longrp: false, closer: false
};

/* ââ Position constants ââ */
const POSITIONS_BATTER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

// The 8 fielding positions every team must cover (DH is optional/flexible)
const POSITIONS_REQUIRED = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/* ââ App State ââ */
const AppState = {
  phase: 'setup', // 'setup' | 'pool' | 'draft' | 'lineup' | 'game'

  teams: [
    {
      name: '',
      batters: [],    // player objects in draft order (includes two7ay)
      pitchers: [],   // player objects in draft order (includes two-way)
      battingOrder: new Array(9).fill(null),  // player objects in slots 0<ä¸!
      pitchingOrder: [],  // [starter, rp1, rp2, ...]
    },
    {
      name: '',
      batters: [],
      pitchers: [],
      battingOrder: new Array(9).fill(null),
      pitchingOrder: [],
    },
  ],

  pool: [],         // all players added to the pool
  draftPicks: [],   // { pickNum, teamIdx, player } history
  currentPickNum: 0,  // 0-based, team = currentPickNum % 2
  draftComplete: false,

  // Lineup phase: which team is currently setting their lineup
  lineupTeamIdx: 0,

  // Unique id counter
  _nextId: 1,

  // ââ Helpers ââ

  newId() {
    return this._nextId++;
  },

  currentDraftTeam() {
    const natural = this.currentPickNum % 2;
    const other   = 1 - natural;
    // If the natural team has no valid picks left, give the turn to the other team
    const canPick = t =>
      this.canPickType(t, 'batter') ||
      this.canPickType(t, 'pitcher') ||
      this.canPickType(t, 'twoway');
    if (!canPick(natural) && canPick(other)) return other;
    return natural;
  },

  isTwoWay(player) {
    return player.type === 'twoway';
  },

  // Count non-duplicate batters and pitchers on a team
  // (two-way players appear in both arrays but are one player)
  teamBatterCount(teamIdx) {
    return this.teams[teamIdx].batters.length;
  },

  teamPitcherCount(teamIdx) {
    return this.teams[teamIdx].pitchers.length;
  },

  teamRosterMinMet(teamIdx) {
    if (this.teamBatterCount(teamIdx)  < 10) return false;
    if (this.teamPitcherCount(teamIdx) < 3)  return false;
    // All 8 required positions must be covered by the drafted batter pool
    const covered = this.positionsCovered(teamIdx);
    return POSITIONS_REQUIRED.every(pos => covered.has(pos));
  },

  bothRosterMinMet() {
    return this.teamRosterMinMet(0) && this.teamRosterMinMet(1);
  },

  // Returns positions already covered by drafted batters on a team
  positionsCovered(teamIdx) {
    const covered = new Set();
    this.teams[teamIdx].batters.forEach(p => {
      (p.positions || []).forEach(pos => covered.add(pos));
    });
    return covered;
  },

  // Returns required positions not yet covered
  positionsNeeded(teamIdx) {
    const covered = this.positionsCovered(teamIdx);
    return POSITIONS_REQUIRED.filter(pos => !covered.has(pos));
  },

  teamNeedsLabel(teamIdx) {
    const t = this.teams[teamIdx];
    const needs = [];
    const batNeeded  = 10 - t.batters.length;
    const pitNeeded  = 3 - t.pitchers.length;
    if (batNeeded > 0)  needs.push(`${batNeeded} batter${batNeeded !== 1 ? 's' : ''}`);
    if (pitNeeded > 0)  needs.push(`${pitNeeded} pitcher${pitNeeded !== 1 ? 's' : ''}`);

    const missingPos = this.positionsNeeded(teamIdx);
    if (missingPos.length > 0 && missingPos.length <= 4) {
      needs.push(`pos: ${missingPos.join(', ')}`);
    } else if (missingPos.length > 4) {
      needs.push(`${missingPos.length} positions uncovered`);
    }

    return needs.length ? needs.join(' Â· ') : 'Roster complete â';
  },

  // Can the current picking team pick this player type?
  canPickType(teamIdx, playerType) {
    const t = this.teams[teamIdx];
    // 10 batters per team (9 in lineup + 1 bench), up to 4 pitchers
    const battersFull  = t.batters.length >= 10;
    const pitchersFull = t.pitchers.length >= 4;

    if (playerType === 'batter')  return !battersFull;
    if (playerType === 'pitcher') return !pitchersFull;
    if (playerType === 'twoway')  return !battersFull && !pitchersFull;
    return false;
  },

  poolCounts() {
    // Two7ay players count toward both batters and pitchers
    let batters  = 0;
    let pitchers = 0;
    this.pool.forEach(p => {
      if (p.type === 'batter' || p.type === 'twoway')  batters++;
      if (p.type === 'pitcher' || p.type === 'twoway') pitchers++;
    });
    return { batters, pitchers };
  },

  poolReady() {
    const { batters, pitchers } = this.poolCounts();
    if (batters < 20 || pitchers < 6) return false;
    // Each required position needs at least 2 players so both teams can cover it
    const posCounts = {};
    POSITIONS_REQUIRED.forEach(pos => { posCounts[pos] = 0; });
    this.pool.forEach(p => {
      if (p.type === 'batter' || p.type === 'twoway') {
        (p.positions || []).forEach(pos => { if (pos in posCounts) posCounts[pos]++; });
      }
    });
    return POSITIONS_REQUIRED.every(pos => posCounts[pos] >= 2);
  },

  // Get pool players not yet drafted
  availablePool() {
    const drafted = new Set(this.draftPicks.map(p => p.player.id));
    return this.pool.filter(p => !drafted.has(p.id));
  },

  reset() {
    this.phase = 'setup';
    this.teams = [
      { name: '', batters: [], pitchers: [], battingOrder: new Array(9).fill(null), pitchingOrder: [] },
      { name: '', batters: [], pitchers: [], battingOrder: new Array(9).fill(null), pitchingOrder: [] },
    ];
    this.pool = [];
    this.draftPicks = [];
    this.currentPickNum = 0;
    this.draftComplete = false;
    this.lineupTeamIdx = 0;
    this._nextId = 1;
  },
}
