/* ═══════════════════════════════════════════
   Diamond Dice — App Entry Point
   Phase routing and event wiring
═══════════════════════════════════════════ */

'use strict';

const App = (() => {

  /* ─────────────────────────────────────────
     PHASE TRANSITIONS
  ───────────────────────────────────────── */

  const PHASES = ['setup', 'pool', 'draft', 'lineup', 'game'];

  function showPhase(name) {
    PHASES.forEach(p => {
      const el = document.getElementById(`phase-${p}`);
      if (el) el.classList.toggle('hidden', p !== name);
    });
    AppState.phase = name;
  }

  /* ─────────────────────────────────────────
     SETUP PHASE
  ───────────────────────────────────────── */

  function initSetup() {
    const form = document.getElementById('setup-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const t1 = document.getElementById('team1-name').value.trim();
      const t2 = document.getElementById('team2-name').value.trim();
      if (!t1 || !t2) {
        alert('Please enter both team names.');
        return;
      }
      AppState.teams[0].name = t1;
      AppState.teams[1].name = t2;
      goToPool();
    });
  }

  function goToPool() {
    showPhase('pool');
    UI.renderPoolPhase();
  }

  /* ─────────────────────────────────────────
     POOL PHASE
  ───────────────────────────────────────── */

  let _poolFilter = 'all';

  function initPool() {
    // Type toggle (Batter / Pitcher / Two-Way)
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        document.getElementById('player-type').value = type;
        // Show batter attrs for batter OR twoway; pitcher attrs for pitcher OR twoway
        const showBatter  = type === 'batter'  || type === 'twoway';
        const showPitcher = type === 'pitcher' || type === 'twoway';
        document.getElementById('batter-attrs').classList.toggle('hidden', !showBatter);
        document.getElementById('pitcher-attrs').classList.toggle('hidden', !showPitcher);
      });
    });

    // Position chips (multi-select)
    document.querySelectorAll('.pos-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
      });
    });

    // Helper to read selected positions
    function getSelectedPositions() {
      return Array.from(document.querySelectorAll('.pos-chip.active'))
        .map(c => c.dataset.pos);
    }

    // Add player form
    const form = document.getElementById('add-player-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const type = document.getElementById('player-type').value;
      const result = Draft.addPlayerToPool({
        name:      document.getElementById('player-name').value,
        type,
        positions: getSelectedPositions(),
        contact:   document.getElementById('attr-contact').value,
        power:     document.getElementById('attr-power').value,
        speed:     document.getElementById('attr-speed').value,
        fielding:  document.getElementById('attr-fielding').value,
        pitching:  document.getElementById('attr-pitching').value,
        stamina:   document.getElementById('attr-stamina').value,
      });
      if (result.ok) {
        document.getElementById('player-name').value = '';
        // Reset position chips
        document.querySelectorAll('.pos-chip').forEach(c => c.classList.remove('active'));
        document.getElementById('player-name').focus();
        UI.renderPoolPhase(_poolFilter);
      } else {
        alert(result.error);
      }
    });

    // Pool filter buttons
    document.querySelectorAll('#phase-pool .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#phase-pool .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _poolFilter = btn.dataset.filter;
        UI.renderPoolPhase(_poolFilter);
      });
    });

    // Remove player (delegated)
    document.getElementById('pool-list').addEventListener('click', e => {
      const btn = e.target.closest('.remove-player-btn');
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      Draft.removePlayerFromPool(id);
      UI.renderPoolPhase(_poolFilter);
    });

    // Load sample players
    document.getElementById('load-sample-btn').addEventListener('click', () => {
      if (typeof SAMPLE_PLAYERS === 'undefined') return;
      let added = 0;
      SAMPLE_PLAYERS.forEach(p => {
        // Avoid duplicates if already loaded
        const exists = AppState.pool.some(existing => existing.name === p.name);
        if (!exists) {
          Draft.addPlayerToPool(p);
          added++;
        }
      });
      document.getElementById('load-sample-btn').textContent = `✓ ${added} players loaded`;
      document.getElementById('load-sample-btn').disabled = true;
      UI.renderPoolPhase(_poolFilter);
    });

    // Start draft button
    document.getElementById('start-draft-btn').addEventListener('click', () => {
      if (AppState.poolReady()) goToDraft();
    });
  }

  /* ─────────────────────────────────────────
     DRAFT PHASE
  ───────────────────────────────────────── */

  let _draftFilter    = 'all';
  let _draftPosFilter = null;

  function goToDraft() {
    showPhase('draft');
    _draftFilter    = 'all';
    _draftPosFilter = null;
    UI.renderDraftPhase(_draftFilter, _draftPosFilter);
  }

  function initDraft() {
    // Type filter buttons
    document.querySelectorAll('#phase-draft .draft-pool-header-top .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#phase-draft .draft-pool-header-top .filter-btn')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _draftFilter = btn.dataset.filter;

        // Show/hide position sub-filter
        const posRow = document.getElementById('draft-pos-filter');
        if (_draftFilter === 'batter') {
          posRow.classList.remove('hidden');
        } else {
          posRow.classList.add('hidden');
          // Reset pos filter and its active state
          _draftPosFilter = null;
          posRow.querySelectorAll('.filter-btn').forEach((b, i) => {
            b.classList.toggle('active', i === 0); // "All" active
          });
        }

        UI.renderDraftPhase(_draftFilter, _draftPosFilter);
      });
    });

    // Position sub-filter buttons
    document.getElementById('draft-pos-filter').querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('draft-pos-filter').querySelectorAll('.filter-btn')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _draftPosFilter = btn.dataset.pos === 'all' ? null : btn.dataset.pos;
        UI.renderDraftPhase(_draftFilter, _draftPosFilter);
      });
    });

    // Auto-draft button
    document.getElementById('auto-draft-btn').addEventListener('click', () => {
      Draft.autoDraft();
      if (Draft.isDraftComplete()) {
        goToLineup();
      } else {
        UI.renderDraftPhase(_draftFilter, _draftPosFilter);
      }
    });
  }

  /* ─────────────────────────────────────────
     LINEUP PHASE
  ───────────────────────────────────────── */

  function goToLineup() {
    AppState.lineupTeamIdx = 0;
    UI.resetLineupSelection();
    showPhase('lineup');
    UI.renderLineupPhase(0);
    initLineupConfirm();
  }

  function initLineupConfirm() {
    const btn = document.getElementById('lineup-confirm-btn');
    // Re-bind to avoid duplicate listeners
    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);

    // Re-bind auto-lineup button
    const autoBtn = document.getElementById('auto-lineup-btn');
    const freshAuto = autoBtn.cloneNode(true);
    autoBtn.parentNode.replaceChild(freshAuto, autoBtn);
    freshAuto.addEventListener('click', () => {
      const teamIdx = AppState.lineupTeamIdx;
      Draft.autoSetLineup(teamIdx);
      UI.resetLineupSelection();
      UI.renderLineupPhase(teamIdx);
      initLineupConfirm();
    });

    freshBtn.addEventListener('click', () => {
      const teamIdx = AppState.lineupTeamIdx;

      // Save pitching order to state if not already committed
      const team = AppState.teams[teamIdx];
      if (!team.pitchingOrder.length) return;

      if (teamIdx === 0) {
        // Move to team 2 lineup
        AppState.lineupTeamIdx = 1;
        UI.resetLineupSelection();
        UI.renderLineupPhase(1);
        initLineupConfirm();
      } else {
        // Both lineups set — go to game
        goToGame();
      }
    });
  }

  /* ─────────────────────────────────────────
     GAME PHASE
  ───────────────────────────────────────── */

  function goToGame() {
    showPhase('game');
    // Delegate to game module (Game.init handles everything from here)
    if (typeof Game !== 'undefined') {
      Game.init(AppState);
    } else {
      UI.renderGamePlaceholder();
    }
  }

  /* ─────────────────────────────────────────
     BOOTSTRAP
  ───────────────────────────────────────── */

  function init() {
    showPhase('setup');
    initSetup();
    initPool();
    initDraft();
  }

  return {
    init,
    goToPool,
    goToDraft,
    goToLineup,
    goToGame,
  };

})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
