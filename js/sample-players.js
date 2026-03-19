// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   Diamond Dice — Sample Player Pool
//   Classic MLB players rated per Diamond Dice rules.
//    Ratings based on career stats where available.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

const SAMPLE_PLAYERS = [

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     TWO-WAY PLAYERS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Babe Ruth', type: 'twoway',
    positions: ['RF'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'B',  // .342 avg, 714 HR
    pitching: 'A', stamina: 'ace',                        // 2.28 ERA as pitcher
  },
  {
    name: 'Shohei Ohtani', type: 'twoway',
    positions: ['DH'],
    contact: 'B', power: 'A', speed: 'B', fielding: 'B',  // .274 avg, 44 HR, 20 SB
    pitching: 'A', stamina: 'ace',                        // sub-3.00 ERA
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     CATCHERS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Johnny Bench', type: 'batter', positions: ['C'],
    contact: 'B', power: 'A', speed: 'C', fielding: 'A',  // .267, 389 HR, GG x10
  },
  {
    name: 'Mike Piazza', type: 'batter', positions: ['C'],
    contact: 'A', power: 'A', speed: 'D', fielding: 'D',  // .308, 427 HR, poor framing
  },
  {
    name: 'Yogi Berra', type: 'batter', positions: ['C'],
    contact: 'A', power: 'B', speed: 'C', fielding: 'B',  // .285, 358 HR
  },
  {
    name: 'Ivan Rodriguez', type: 'batter', positions: ['C'],
    contact: 'B', power: 'B', speed: 'B', fielding: 'A',  // .296, 311 HR, GG x13
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     FIRST BASE
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Lou Gehrig', type: 'batter', positions: ['1B'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'A',  // .340, 493 HR
  },
  {
    name: 'Albert Pujols', type: 'batter', positions: ['1B'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'A',  // .296, 700 HR, GG x2
  },
  {
    name: 'Mark McGwire', type: 'batter', positions: ['1B'],
    contact: 'C', power: 'A', speed: 'D', fielding: 'C',  // .263, 583 HR
  },
  {
    name: 'Frank Thomas', type: 'batter', positions: ['1B', 'DH'],
    contact: 'A', power: 'A', speed: 'D', fielding: 'C',  // .301, 521 HR
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SECOND BASE
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Jackie Robinson', type: 'batter', positions: ['2B', 'SS', '3B', 'LF'],
    contact: 'A', power: 'C', speed: 'A', fielding: 'A',  // .311, 197 SB,
  },
  {
    name: 'Roberto Alomar', type: 'batter', positions: ['2B'],
    contact: 'A', power: 'B', speed: 'A', fielding: 'A',  // .300, GG x10
  },
  {
    name: 'Joe Morgan', type: 'batter', positions: ['2B'],
    contact: 'C', power: 'C', speed: 'A', fielding: 'A',  // .271, 689 SB,
  },
  {
    name: 'Rod Carew', type: 'batter', positions: ['2B', '1B'],
    contact: 'A', power: 'C', speed: 'C', fielding: 'C',  // .328 career avg
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SHORTSTOP
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Derek Jeter', type: 'batter', positions: ['SS'],
    contact: 'A', power: 'C', speed: 'C', fielding: 'C',  // .310, 358 SB,
  },
  {
    name: 'Ozzie Smith', type: 'batter', positions: ['SS'],
    contact: 'C', power: 'D', speed: 'A', fielding: 'A',  // .262, 580 SB, GG x13
  },
  {
    name: 'Alex Rodriguez', type: 'batter', positions: ['SS', '3B'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'A',  // .295, 696 HR
  },
  {
    name: 'Cal Ripken Jr', type: 'batter', positions: ['SS', '3B'],
    contact: 'B', power: 'B', speed: 'D', fielding: 'A',  // .276, 431 HR, GG x2
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     THIRD BASE
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Mike Schmidt', type: 'batter', positions: ['3B'],
    contact: 'B', power: 'A', speed: 'B', fielding: 'A',  // .267, 548 HR, GG x10
  },
  {
    name: 'Brooks Robinson', type: 'batter', positions: ['3B'],
    contact: 'C', power: 'C', speed: 'C', fielding: 'A',  // .267, GG x16,
  },
  {
    name: 'Chipper Jones', type: 'batter', positions: ['3B', 'LF'],
    contact: 'A', power: 'A', speed: 'B', fielding: 'B',  // .303, 468 HR
  },
  {
    name: 'George Brett', type: 'batter', positions: ['3B', '1B'],
    contact: 'A', power: 'A', speed: 'B', fielding: 'B',  // .305, 317 HR
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     LEFT FIELD
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Ted Williams', type: 'batter', positions: ['LF'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'C',  // .344, 521 HR
  },
  {
    name: 'Barry Bonds', type: 'batter', positions: ['LF'],
    contact: 'A', power: 'A', speed: 'A', fielding: 'A',  // .298, 762 HR, GG x8
  },
  {
    name: 'Rickey Henderson', type: 'batter', positions: ['LF', 'CF'],
    contact: 'B', power: 'B', speed: 'A', fielding: 'B',  // .279, 1406 SB (all-time)
  },
  {
    name: 'Stan Musial', type: 'batter', positions: ['LF', '1B'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'C',  // .331, 475 HR
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     CENTER FIELD
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Willie Mays', type: 'batter', positions: ['CF'],
    contact: 'A', power: 'A', speed: 'A', fielding: 'A',  // .302, 660 HR, GG x12
  },
  {
    name: 'Mickey Mantle', type: 'batter', positions: ['CF'],
    contact: 'A', power: 'A', speed: 'A', fielding: 'C',  // .298, 536 HR
  },
  {
    name: 'Ken Griffey Jr', type: 'batter', positions: ['CF'],
    contact: 'A', power: 'A', speed: 'A', fielding: 'A',  // .284, 630 HR, GG x10
  },
  {
    name: 'Ty Cobb', type: 'batter', positions: ['CF', 'RF'],
    contact: 'A', power: 'C', speed: 'A', fielding: 'B',  // .366 (all-time high), 892 SB,
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     RIGHT FIELD
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Roberto Clemente', type: 'batter', positions: ['RF'],
    contact: 'A', power: 'B', speed: 'B', fielding: 'A',  // .317, GG x12
  },
  {
    name: 'Tony Gwynn', type: 'batter', positions: ['RF'],
    contact: 'A', power: 'C', speed: 'B', fielding: 'A',  // .338 career, GG x5
  },
  {
    name: 'Hank Aaron', type: 'batter', positions: ['RF', 'LF'],
    contact: 'A', power: 'A', speed: 'C', fielding: 'C',  // .305, 755 HR
  },
  {
    name: 'Ichiro Suzuki', type: 'batter', positions: ['RF'],
    contact: 'A', power: 'D', speed: 'A', fielding: 'A',  // .311, 509 SB, GG x10
  },
  {
    name: 'Pete Rose', type: 'batter', positions: ['LF', 'RF', '2B', '3B', '1B'],
    contact: 'A', power: 'C', speed: 'C', fielding: 'C',  // .303, all-time hits leader
  },

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PITCHERS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  {
    name: 'Sandy Koufax', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 2.76 ERA, led NL 3x
  },
  {
    name: 'Roger Clemens', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 3.12 ERA, 354 wins
  },
  {
    name: 'Randy Johnson', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 3.29 ERA, 4875 K
  },
  {
    name: 'Greg Maddux', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 3.16 ERA, GG x18
  },
  {
    name: 'Pedro Martinez', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 2.93 ERA
  },
  {
    name: 'Bob Gibson', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 2.91 ERA
  },
  {
    name: 'Walter Johnson', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 2.17 ERA
  },
  {
    name: 'Mariano Rivera', type: 'pitcher',
    pitching: 'A', stamina: 'closer',             // 2.21 ERA, all-time saves leader
  },
  {
    name: 'Tom Seaver', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 2.86 ERA
  },
  {
    name: 'Nolan Ryan', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 3.19 ERA, 5714 K
  },
  {
    name: 'Justin Verlander', type: 'pitcher',
    pitching: 'B', stamina: 'ace',                // 3.33 ERA
  },
  {
    name: 'Roy Halladay', type: 'pitcher',
    pitching: 'A', stamina: 'ace',                // 3.38 ERA
  },
  {
    name: 'Curt Schilling', type: 'pitcher',
    pitching: 'C', stamina: 'ace',                // 3.46 ERA
  },
  {
    name: 'Trevor Hoffman', type: 'pitcher',
    pitching: 'B', stamina: 'closer',             // 2.87 ERA, 601 saves
  },
  {
    name: 'CC Sabathia', type: 'pitcher',
    pitching: 'C', stamina: 'midsp',              // 3.74 ERA
  },
  {
    name: 'Dennis Eckersley', type: 'pitcher',
    pitching: 'B', stamina: 'closer',             // 3.50 ERA, 390 saves
  },
];
