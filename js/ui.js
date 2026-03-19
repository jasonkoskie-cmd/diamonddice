/* ═══════════════════════════════════════════
   Diamond Dice — UI Rendering
   All render/refresh functions for draft phases
═══════════════════════════════════════════ */

'use strict';

const UI = (() => {

  /* ─────────────────────────────────────────
     SHARED HELPERS
  ───────────────────────────────────────── */

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function gradeClass(g) {
    return `grade-${g}`;
  }

  function positionBadgesHtml(positions) {
    if (!positions || positions.length === 0) return '';
    return positions.map(pos =>
      `<span class="pos-badge">${pos}</span>`
    ).join('');
  }

  function playerAttrsHtml(player) {
    const isBatter  = player.type === 'batter'  || player.type === 'twoway';
    const isPitcher = player.type === 'pitcher' || player.type === 'twoway';
    let html = '';

    if (isBatter) {
      html += `
        <span class="attr-chip"><span class="attr-label">CON</span> <span class="attr-val ${gradeClass(player.contact)}">${player.contact}</span></span>
        <span class="attr-chip"><span class="attr-label">PWR</span> <span class="attr-val ${gradeClass(player.power)}">${player.power}</span></span>
        <span class="attr-chip"><span class="attr-label">SPD</span> <span class="attr-val ${gradeClass(player.speed)}">${player.speed}</span></span>
        <span class="attr-chip"><span class="attr-label">FLD</span> <span class="attr-val ${gradeClass(player.fielding)}">${player.fielding}</span></span>`;
    }
    if (isBatter && isPitcher) {
      html += `<span class="attr-chip attr-divider">|</span>`;
    }
    if (isPitcher) {
      html += `
        <span class="attr-chip"><span class="attr-label">PIT</span> <span class="attr-val ${gradeClass(player.pitching)}">${player.pitching}</span></span>
        <span class="attr-chip"><span class="attr-label">${STAMINA_LABELS[player.stamina]}</span></span>`;
    }
    return html;
  }

  function typeBadgeHtml(player) {
    if (player.type === 'twoway') {
      return `<span class="player-type-badge badge-twoway">⚡ 2-WAY</span>`;
    }
    if (player.type === 'batter') {
      return `<span class="player-type-badge badge-batter">BAT</span>`;
    }
    return `<span class="player-type-badge badge-pitcher">PIT</span>`;
  }

  function playerCardHtml(player, opts = {}) {
    const { removable = false, selectable = false, selected = false, drafted = false, disabled = false } = opts;
    const classes = ['player-card',
      selectable && !disabled ? 'selectable' : '',
      selected ? 'selected' : '',
      drafted ? 'drafted' : '',
      disabled ? 'disabled' : '',
    ].filter(Boolean).join(' ');

    const posBadges = (player.type !== 'pitcher')
      ? `<div class="player-positions">${positionBadgesHtml(player.positions)}</div>`
      : '';

    const removeBtn = removable
      ? `<button class="btn btn-danger remove-player-btn" data-id="${player.id}" title="Remove">✕</button>`
      : '';

    const dataAttrs = selectable ? `data-id="${player.id}"` : '';

    return `
      <div class="${classes}" ${dataAttrs}>
        ${typeBadgeHtml(player)}
        <div class="player-info">
          <div class="player-name-row">
            <span class="player-name">${escHtml(player.name)}</span>
            ${posBadges}
          </div>
          <div class="player-attrs">${playerAttrsHtml(player)}</div>
        </div>
        ${removeBtn}
      </div>`;
  }

  /* ─────────────────────────────────────────
     POOL PHASE
  ───────────────────────────────────────── */

  function renderPoolPhase(filter = 'all') {
    const { batters, pitchers } = AppState.poolCounts();

    document.getElementById('pool-counts').textContent =
      `${batters} batter${batters !== 1 ? 's' : ''} · ${pitchers} pitcher${pitchers !== 1 ? 's' : ''}`;

    // Batter count requirement (20 for 2 teams × 10 roster spots)
    const reqBatters  = document.getElementById('req-batters');
    const reqPitchers = document.getElementById('req-pitchers');
    const reqPositions = document.getElementById('req-positions');

    if (batters >= 20) {
      reqBatters.classList.add('met');
      reqBatters.innerHTML = '<span class="req-icon">✓</span> At least 20 batters';
    } else {
      reqBatters.classList.remove('met');
      reqBatters.innerHTML = `<span class="req-icon">○</span> At least 20 batters <em>(${batters}/20)</em>`;
    }
    if (pitchers >= 6) {
      reqPitchers.classList.add('met');
      reqPitchers.innerHTML = '<span class="req-icon">✓</span> At least 6 pitchers';
    } else {
      reqPitchers.classList.remove('met');
      reqPitchers.innerHTML = `<span class="req-icon">○</span> At least 6 pitchers <em>(${pitchers}/6)</em>`;
    }

    // Position coverage requirement: each of 8 positions needs 2+ players
    if (reqPositions) {
      const posCounts = {};
      POSITIONS_REQUIRED.forEach(pos => { posCounts[pos] = 0; });
      AppState.pool.forEach(p => {
        if (p.type === 'batter' || p.type === 'twoway') {
          (p.positions || []).forEach(pos => { if (pos in posCounts) posCounts[pos]++; });
        }
      });
      const missing = POSITIONS_REQUIRED.filter(pos => posCounts[pos] < 2);
      if (missing.length === 0) {
        reqPositions.classList.add('met');
        reqPositions.innerHTML = '<span class="req-icon">✓</span> All positions covered (2+ each)';
      } else {
        reqPositions.classList.remove('met');
        const chips = missing.map(p => `<span class="need-chip" style="font-size:.6rem">${p}</span>`).join('');
        reqPositions.innerHTML = `<span class="req-icon">○</span> Need 2+ players at: ${chips}`;
      }
    }

    document.getElementById('start-draft-btn').disabled = !AppState.poolReady();

    // Pool list
    const list = document.getElementById('pool-list');
    let filtered;
    if (filter === 'all') {
      filtered = AppState.pool;
    } else if (filter === 'batter') {
      filtered = AppState.pool.filter(p => p.type === 'batter' || p.type === 'twoway');
    } else {
      filtered = AppState.pool.filter(p => p.type === 'pitcher' || p.type === 'twoway');
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">No ${filter === 'all' ? '' : filter + ' '}players added yet.</div>`;
      return;
    }

    list.innerHTML = filtered.map(p => playerCardHtml(p, { removable: true })).join('');
  }

  /* ─────────────────────────────────────────
     DRAFT PHASE
  ───────────────────────────────────────── */

  function renderDraftPhase(filter = 'all', posFilter = null) {
    const teamIdx   = AppState.currentDraftTeam();
    const pickNum   = AppState.currentPickNum + 1;
    const selected  = Draft.getSelectedPlayer();
    const available = AppState.availablePool();

    document.getElementById('draft-pick-label').textContent = `Pick ${pickNum}`;
    document.getElementById('draft-turn-label').textContent =
      `${AppState.teams[teamIdx].name}'s turn`;

    [0, 1].forEach(i => renderTeamPanel(i, i === teamIdx));
    renderDraftPool(available, filter, posFilter, selected, teamIdx);
  }

  function renderTeamPanel(teamIdx, isActiveTurn) {
    const team        = AppState.teams[teamIdx];
    const panel       = document.getElementById(`team${teamIdx + 1}-panel`);
    const header      = document.getElementById(`team${teamIdx + 1}-panel-header`);
    const battersList = document.getElementById(`team${teamIdx + 1}-batters`);
    const pitchersList = document.getElementById(`team${teamIdx + 1}-pitchers`);
    const needsEl     = document.getElementById(`team${teamIdx + 1}-needs`);

    panel.classList.toggle('active-turn', isActiveTurn);

    const rosterDone = AppState.teamRosterMinMet(teamIdx);
    const turnLabel = isActiveTurn
      ? `<span class="pick-indicator your-turn">▶ Picking now</span>`
      : rosterDone
        ? `<span class="pick-indicator waiting" style="color:#4a8a28">✓ Roster complete</span>`
        : `<span class="pick-indicator waiting">Waiting…</span>`;
    header.innerHTML = `${escHtml(team.name)}${turnLabel}`;

    // Batters (10 slots: 9 in lineup + 1 bench)
    battersList.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const player = team.batters[i];
      const li = document.createElement('li');
      if (player) {
        // Two-way players bat as DH; regular batters show their primary field position
        const displayPos  = player.type === 'twoway' ? 'DH' : (player.positions ? player.positions[0] : '');
        const twoWayMark  = player.type === 'twoway' ? ' <span style="color:#e67e22">⚡</span>' : '';
        const slotLabel   = i === 9 ? 'B' : `${i + 1}`;
        li.className = 'roster-slot filled';
        li.innerHTML = `${slotLabel}. ${escHtml(player.name)}${twoWayMark}
          <span class="slot-badges">
            ${displayPos ? `<span class="pos-badge pos-badge--sm">${displayPos}</span>` : ''}
            <span class="attr-val ${gradeClass(player.contact)}" title="Contact">${player.contact}</span>
          </span>`;
      } else {
        li.className = 'roster-slot';
        li.textContent = i === 9 ? `B. — (bench)` : `${i + 1}. —`;
      }
      battersList.appendChild(li);
    }

    // Pitchers (up to 4 slots)
    pitchersList.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const player = team.pitchers[i];
      const li = document.createElement('li');
      if (player) {
        const roleShort  = { ace: 'ACE', midsp: 'SP', longrp: 'LRP', closer: 'CLO' }[player.stamina] || 'RP';
        const twoWayMark = player.type === 'twoway' ? ' <span style="color:#e67e22">⚡</span>' : '';
        const roleLabel  = player.type === 'twoway'
          ? `<span class="pos-badge pos-badge--sm" style="background:rgba(230,126,18,.2);color:#a04000;border-color:#a04000">DH/P</span>`
          : `<span style="font-size:.68rem;color:#888">${roleShort}</span>`;
        li.className = 'roster-slot filled';
        li.innerHTML = `${escHtml(player.name)}${twoWayMark}
          <span class="slot-badges">
            <span class="attr-val ${gradeClass(player.pitching)}" title="Pitching">${player.pitching}</span>
            ${roleLabel}
          </span>`;
      } else {
        li.className = 'roster-slot';
        li.textContent = i < 3 ? `Pitcher ${i + 1} —` : `P4 (opt.) —`;
      }
      pitchersList.appendChild(li);
    }

    // Position coverage
    const covered = AppState.positionsCovered(teamIdx);
    const missing = AppState.positionsNeeded(teamIdx);
    const posHtml = POSITIONS_REQUIRED.map(pos => {
      const met = covered.has(pos);
      return `<span class="need-chip ${met ? 'met' : ''}">${pos}</span>`;
    }).join('');

    needsEl.innerHTML = `
      <div style="margin-bottom:6px"><strong>Still needs:</strong> ${AppState.teamNeedsLabel(teamIdx)}</div>
      <div>${posHtml}</div>`;
  }

  function renderDraftPool(available, filter, posFilter, selected, activeTeamIdx) {
    const listEl = document.getElementById('draft-pool-list');

    // Pick confirmation bar
    let pickBarHtml = '';
    if (selected) {
      pickBarHtml = `
        <div class="draft-pick-bar">
          <span>Selected:</span>
          <span class="selected-name">${escHtml(selected.name)}</span>
          ${selected.type === 'twoway' ? '<span style="font-size:.8rem;color:#f39c12">⚡ Fills batter + pitcher slot</span>' : ''}
          <button class="btn btn-success" id="confirm-pick-btn">Draft ⚾</button>
          <button class="btn btn-ghost" id="cancel-pick-btn" style="background:transparent;color:#fff;border-color:#fff">Cancel</button>
        </div>`;
    }

    // Type filter
    let filtered;
    if (filter === 'all') {
      filtered = available;
    } else if (filter === 'batter') {
      filtered = available.filter(p => p.type === 'batter' || p.type === 'twoway');
    } else {
      filtered = available.filter(p => p.type === 'pitcher' || p.type === 'twoway');
    }

    // Position sub-filter (only relevant when showing batters / two-way)
    if (posFilter && posFilter !== 'all') {
      filtered = filtered.filter(p => p.positions && p.positions.includes(posFilter));
    }

    const cardsHtml = filtered.map(p => {
      const isSelected = selected && p.id === selected.id;
      const canPick = Draft.canCurrentTeamPick(p.type);
      return playerCardHtml(p, { selectable: canPick, selected: isSelected, disabled: !canPick });
    }).join('');

    listEl.innerHTML = pickBarHtml +
      (filtered.length ? cardsHtml : `<div class="empty-state">No players available.</div>`);

    // Bind confirm/cancel
    if (selected) {
      document.getElementById('confirm-pick-btn')?.addEventListener('click', () => {
        if (Draft.confirmPick()) {
          if (Draft.isDraftComplete()) {
            App.goToLineup();
          } else {
            renderDraftPhase(filter, posFilter);
          }
        }
      });
      document.getElementById('cancel-pick-btn')?.addEventListener('click', () => {
        Draft.selectPlayer(selected.id);
        renderDraftPhase(filter, posFilter);
      });
    }

    listEl.querySelectorAll('.player-card.selectable').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id, 10);
        Draft.selectPlayer(id);
        renderDraftPhase(filter, posFilter);
      });
    });
  }

  /* ─────────────────────────────────────────
     LINEUP PHASE
  ───────────────────────────────────────── */

  let _lineupSelectedBatter = null;

  function renderLineupPhase(teamIdx) {
    const team = AppState.teams[teamIdx];

    document.getElementById('lineup-phase-label').textContent = 'Set Your Lineup';
    document.getElementById('lineup-team-label').textContent = team.name;
    document.getElementById('lineup-instructions-text').textContent =
      `${team.name}: assign 9 of your 10 batters to the batting order (1 sits on bench), then set your pitching staff order.`;

    renderBattingOrderUI(teamIdx);
    renderCoverageStrip(teamIdx);
    renderPitchingStaffUI(teamIdx);
    updateLineupConfirmBtn(teamIdx, teamIdx === 1);
  }

  function playerAttrShortHtml(player) {
    const isBatter  = player.type === 'batter'  || player.type === 'twoway';
    const isPitcher = player.type === 'pitcher' || player.type === 'twoway';
    const parts = [];
    if (isBatter) {
      parts.push(`CON <span class="${gradeClass(player.contact)}">${player.contact}</span>`);
      parts.push(`PWR <span class="${gradeClass(player.power)}">${player.power}</span>`);
      parts.push(`SPD <span class="${gradeClass(player.speed)}">${player.speed}</span>`);
    }
    if (isPitcher) {
      parts.push(`PIT <span class="${gradeClass(player.pitching)}">${player.pitching}</span>`);
      parts.push(STAMINA_LABELS[player.stamina]);
    }
    return parts.join(' · ');
  }

  function renderCoverageStrip(teamIdx) {
    const covered = Draft.battingOrderCoverage(teamIdx);
    const chips = POSITIONS_REQUIRED.map(pos => {
      const met = covered.has(pos);
      return `<span class="cov-chip ${met ? 'cov-met' : 'cov-missing'}" title="${met ? pos + ' covered' : pos + ' uncovered'}">${pos}</span>`;
    }).join('');
    const missing = Draft.battingOrderMissingPositions(teamIdx);
    const orderComplete = Draft.battingOrderComplete(teamIdx);

    let statusMsg;
    if (missing.length > 0) {
      statusMsg = `<span class="cov-status cov-warn">Missing: ${missing.join(', ')}</span>`;
    } else if (!orderComplete) {
      // All placed players collectively cover every position, but there are still
      // empty slots — coverage may shift as remaining players are assigned.
      const emptyCount = AppState.teams[teamIdx].battingOrder.filter(p => p === null).length;
      statusMsg = `<span class="cov-status cov-warn">Fill ${emptyCount} empty slot${emptyCount !== 1 ? 's' : ''} to confirm coverage</span>`;
    } else {
      statusMsg = `<span class="cov-status cov-ok">✓ All positions covered</span>`;
    }

    const el = document.getElementById('lineup-coverage');
    if (el) el.innerHTML = `<span class="cov-label">Field Coverage</span>${chips}${statusMsg}`;
  }

  function renderBattingOrderUI(teamIdx) {
    const team       = AppState.teams[teamIdx];
    const orderEl    = document.getElementById('lineup-order');
    const benchEl    = document.getElementById('lineup-bench');
    const unassigned = Draft.unassignedBatters(teamIdx);

    orderEl.innerHTML = team.battingOrder.map((player, i) => {
      if (player) {
        const primaryPos = player.positions ? player.positions[0] : '';
        const twoWayMark = player.type === 'twoway' ? ' ⚡' : '';
        return `
          <div class="lineup-slot filled" data-slot="${i}">
            <div class="slot-number">${i + 1}</div>
            <div>
              <div class="slot-player">
                ${escHtml(player.name)}${twoWayMark}
                ${primaryPos ? `<span class="pos-badge pos-badge--sm" style="margin-left:5px">${primaryPos}</span>` : ''}
              </div>
              <div class="slot-attrs">${playerAttrShortHtml(player)}</div>
            </div>
          </div>`;
      } else {
        const isTarget = _lineupSelectedBatter !== null;
        return `
          <div class="lineup-slot empty ${isTarget ? 'target' : ''}" data-slot="${i}">
            <div class="slot-number">${i + 1}</div>
            <span class="slot-empty-label">${isTarget ? '← Place here' : 'Empty'}</span>
          </div>`;
      }
    }).join('');

    benchEl.innerHTML = unassigned.length
      ? unassigned.map(p => {
          const primaryPos = p.positions ? p.positions[0] : '';
          const twoWayMark = p.type === 'twoway' ? ' ⚡' : '';
          return `
            <div class="bench-player ${_lineupSelectedBatter && _lineupSelectedBatter.id === p.id ? 'selected' : ''}"
                 data-id="${p.id}">
              ${escHtml(p.name)}${twoWayMark}
              ${primaryPos ? `<span class="pos-badge pos-badge--sm" style="margin-left:4px">${primaryPos}</span>` : ''}
              <div style="font-size:.72rem;color:#888;margin-top:2px">${playerAttrShortHtml(p)}</div>
            </div>`;
        }).join('')
      : `<div class="empty-state" style="padding:10px">All batters placed!</div>`;

    benchEl.querySelectorAll('.bench-player').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id, 10);
        const player = team.batters.find(p => p.id === id);
        _lineupSelectedBatter = (_lineupSelectedBatter && _lineupSelectedBatter.id === id) ? null : player;
        renderBattingOrderUI(teamIdx);
      });
    });

    orderEl.querySelectorAll('.lineup-slot').forEach(el => {
      el.addEventListener('click', () => {
        const slotIdx = parseInt(el.dataset.slot, 10);
        if (_lineupSelectedBatter && el.classList.contains('empty')) {
          Draft.assignBatterToSlot(teamIdx, _lineupSelectedBatter, slotIdx);
          _lineupSelectedBatter = null;
          renderBattingOrderUI(teamIdx);
          renderCoverageStrip(teamIdx);
          updateLineupConfirmBtn(teamIdx, teamIdx === 1);
        } else if (el.classList.contains('filled')) {
          Draft.removeFromBattingOrder(teamIdx, slotIdx);
          renderBattingOrderUI(teamIdx);
          renderCoverageStrip(teamIdx);
          updateLineupConfirmBtn(teamIdx, teamIdx === 1);
        }
      });
    });
  }

  function renderPitchingStaffUI(teamIdx) {
    const team = AppState.teams[teamIdx];
    const container = document.getElementById('lineup-pitching');

    if (!team.pitchingOrder.length) {
      const order = ['ace', 'midsp', 'longrp', 'closer'];
      team.pitchingOrder = [...team.pitchers].sort(
        (a, b) => order.indexOf(a.stamina) - order.indexOf(b.stamina)
      );
    }

    container.innerHTML = `
      <div class="pitching-staff-list" id="pitching-staff-list">
        ${team.pitchingOrder.map((p, i) => {
          const twoWayMark = p.type === 'twoway' ? ' ⚡' : '';
          return `
            <div class="pitcher-slot" data-idx="${i}">
              <span class="pitcher-role-badge ${i === 0 ? 'starter' : 'reliever'}">${i === 0 ? 'Starter' : 'Reliever'}</span>
              <div style="flex:1">
                <div style="font-weight:700;font-size:.9rem">${escHtml(p.name)}${twoWayMark}</div>
                <div style="font-size:.75rem;color:#888">${playerAttrShortHtml(p)}</div>
              </div>
              <div style="display:flex;gap:4px">
                ${i > 0 ? `<button class="btn btn-ghost" style="padding:3px 8px;font-size:.75rem" data-move-up="${i}">↑</button>` : ''}
                ${i < team.pitchingOrder.length - 1 ? `<button class="btn btn-ghost" style="padding:3px 8px;font-size:.75rem" data-move-down="${i}">↓</button>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
      <p style="font-size:.75rem;color:#888;margin-top:8px;">
        The top pitcher is your starter. Use ↑↓ to reorder the bullpen.
      </p>`;

    container.querySelectorAll('[data-move-up]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.moveUp, 10);
        const arr = team.pitchingOrder;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        Draft.setPitchingOrder(teamIdx, arr);
        renderPitchingStaffUI(teamIdx);
        updateLineupConfirmBtn(teamIdx, teamIdx === 1);
      });
    });
    container.querySelectorAll('[data-move-down]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.moveDown, 10);
        const arr = team.pitchingOrder;
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        Draft.setPitchingOrder(teamIdx, arr);
        renderPitchingStaffUI(teamIdx);
        updateLineupConfirmBtn(teamIdx, teamIdx === 1);
      });
    });
  }

  function updateLineupConfirmBtn(teamIdx, isLastTeam) {
    const btn = document.getElementById('lineup-confirm-btn');
    const complete = Draft.lineupComplete(teamIdx);
    btn.disabled = !complete;
    btn.textContent = isLastTeam ? 'Play Ball! ⚾' : `Confirm Lineup — Next: ${AppState.teams[1].name} →`;
  }

  /* ─────────────────────────────────────────
     GAME PLACEHOLDER
  ───────────────────────────────────────── */

  function renderGamePlaceholder() {
    const [t0, t1] = AppState.teams;
    document.getElementById('game-root').innerHTML = `
      <div class="game-placeholder">
        <h2>⚾ Play Ball!</h2>
        <div class="matchup">
          <span>${escHtml(t0.name)}</span>
          <span class="vs">vs</span>
          <span>${escHtml(t1.name)}</span>
        </div>
        <p>Both lineups are set. The game engine is coming in the next build sprint!</p>
        <p style="margin-top:12px;font-size:.8rem">
          Visitor: ${escHtml(t0.name)} · Starter: ${escHtml(t0.pitchingOrder[0]?.name || '—')}<br/>
          Home: ${escHtml(t1.name)} · Starter: ${escHtml(t1.pitchingOrder[0]?.name || '—')}
        </p>
      </div>`;
  }

  /* ─────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────── */
  return {
    renderPoolPhase,
    renderDraftPhase,
    renderLineupPhase,
    renderGamePlaceholder,
    resetLineupSelection() { _lineupSelectedBatter = null; },
  };

})();
