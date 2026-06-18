const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000
const path = require('path');

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..client/dist')));

app.use('/assets', express.static(path.join(__dirname, '../client/dist/assets')));

const db = new sqlite3.Database('./sports.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the sports database.');
});

// HELPER: Move this to the top so all routes can see it
const parseSequence = (seq) => {
    if (!seq) return null;
    const s = seq.toString().trim();
    const rebounds = (s.match(/\//g) || []).length;
    const segments = s.split('/').filter(seg => seg !== "");
    const events = segments.map(seg => ({
        type: seg === '0' ? 'turnover' : 'shot',
        quality: seg === '0' ? 0 : Math.floor(parseInt(seg) / 10)
    }));
    return { rebounds, events, lastQuality: events.length > 0 ? events[events.length - 1].quality : 0 };
};

const calculateMetrics = (rows, gamesPlayed) => {
    let stats = { 
        system: 0, shots: 0, totalQual: 0, stintQual: 0, poss: 0, 
        turnovers: 0, oRebs: 0, ftReb: 0, missedShots: 0 
    };
    
    rows.forEach(row => {
        const p = parseSequence(row.system_sequence);
        if (p) {
            stats.poss++;
            stats.system += (p.lastQuality + p.rebounds);
            
            // Track FT Rebounds (e.g., sequence starts with '/')
            if (row.system_sequence.startsWith('/')) stats.ftReb++;

            p.events.forEach((e, idx) => {
                stats.stintQual += e.quality;
                if (e.type === 'shot') {
                    stats.shots++;
                    stats.totalQual += e.quality;
                    // Logic for tracking OREB on missed shots
                    if (idx < p.events.length - 1 || row.points === 0) {
                        stats.missedShots++;
                        if (idx < p.events.length - 1) stats.oRebs++;
                    }
                } else if (e.type === 'turnover') {
                    stats.turnovers++;
                }
            });
        }
    });

    return {
        ...stats,
        sysG: gamesPlayed > 0 ? (stats.system / gamesPlayed).toFixed(1) : "0.0",
        possG: gamesPlayed > 0 ? (stats.poss / gamesPlayed).toFixed(1) : "0.0",
        ftRebG: gamesPlayed > 0 ? (stats.ftReb / gamesPlayed).toFixed(1) : "0.0",
        oRebPct: stats.missedShots > 0 ? ((stats.oRebs / stats.missedShots) * 100).toFixed(1) + '%' : "0.0%",
        shot_q: stats.shots > 0 ? (stats.totalQual / stats.shots).toFixed(2) : "0.00",
        stint_q: stats.poss > 0 ? (stats.stintQual / stats.poss).toFixed(2) : "0.00",
        result_q: stats.poss > 0 ? (stats.system / stats.poss).toFixed(2) : "0.00"
    };
};

app.get('/api/games', (req, res) => {
    db.all("SELECT * FROM games ORDER BY date DESC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/games/:id/plays', (req, res) => {
    db.all("SELECT * FROM possessions WHERE game_id = ? ORDER BY possession_id ASC", [req.params.id], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// NEW STATS ROUTE (Make sure the OLD one is deleted)
app.get('/api/stats/:teamName', (req, res) => {
    const team = req.params.teamName;
    const sql = `
        SELECT p.*, g.home_team, g.away_team, g.home_score, g.away_score, g.date 
        FROM possessions p 
        JOIN games g ON p.game_id = g.game_id 
        WHERE g.home_team = ? OR g.away_team = ?`;

    db.all(sql, [team, team], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!rows || rows.length === 0) return res.json({ teamName: team, record: "0-0", schedule: [], shotDistribution: { offense: [], defense: [] } });

        const gameIds = [...new Set(rows.map(r => r.game_id))];
        const gamesPlayed = gameIds.length;
        let wins = 0;
        let losses = 0;

        // --- SURGICAL ADDITION START: Build Schedule Log Array ---
        const schedule = gameIds.map(id => {
            const gameRows = rows.filter(r => r.game_id === id);
            const gameInfo = gameRows[0];
            const isHome = gameInfo.home_team === team;
            
            const oppDisplay = isHome ? gameInfo.away_team : `@${gameInfo.home_team}`;
            const teamScore = isHome ? gameInfo.home_score : gameInfo.away_score;
            const oppScore = isHome ? gameInfo.away_score : gameInfo.home_score;
            const gameResult = teamScore > oppScore ? `W ${teamScore}-${oppScore}` : `L ${teamScore}-${oppScore}`;

            const sCounts = { offense: { 6:0, 4:0, 7:0, 11:0, 3:0, 1:0, 0:0 }, defense: { 6:0, 4:0, 7:0, 11:0, 3:0, 1:0, 0:0 } };
            const sTotals = { offense: { system: 0, shots: 0, sQual: 0, poss: 0 }, defense: { system: 0, shots: 0, sQual: 0, poss: 0 } };

            gameRows.forEach(row => {
                if (!row.system_sequence || row.system_sequence.trim() === "") return;
                const isOffense = (row.team_type === 'Home' && isHome) || (row.team_type === 'Away' && !isHome);
                const side = isOffense ? 'offense' : 'defense';

                sTotals[side].poss++;
                const segments = row.system_sequence.split('/').filter(s => s !== "");
                
                segments.forEach((seg, idx) => {
                    const type = seg === '0' ? 0 : Math.floor(parseInt(seg) / 10);
                    if (sCounts[side][type] !== undefined) {
                        sCounts[side][type]++;
                        if (type !== 0) {
                            sTotals[side].shots++;
                            sTotals[side].sQual += type;
                        }
                        if (idx === segments.length - 1) {
                            sTotals[side].system += (type + (row.system_sequence.match(/\//g) || []).length);
                        }
                    }
                });
            });

            const systemResult = sTotals.offense.system > sTotals.defense.system 
                ? `W ${sTotals.offense.system.toFixed(0)}-${sTotals.defense.system.toFixed(0)}` 
                : `L ${sTotals.offense.system.toFixed(0)}-${sTotals.defense.system.toFixed(0)}`;

            const shotMarginRaw = sTotals.offense.shots - sTotals.defense.shots;
            const shotMargin = shotMarginRaw >= 0 ? `+${shotMarginRaw}` : `${shotMarginRaw}`;

            const getSidePct = (side, type) => {
                const total = Object.values(sCounts[side]).reduce((a, b) => a + b, 0);
                return total > 0 ? ((sCounts[side][type] / total) * 100).toFixed(1) + '%' : '0.0%';
            };

            return {
                date: gameInfo.date,
                opponent: oppDisplay,
                gameResult,
                systemResult,
                shotMargin,
                possSummary: `${sTotals.offense.poss}/${sTotals.defense.poss}`,
                sqOff: sTotals.offense.shots > 0 ? (sTotals.offense.sQual / sTotals.offense.shots).toFixed(2) : '0.00',
                rqOff: sTotals.offense.poss > 0 ? (sTotals.offense.system / sTotals.offense.poss).toFixed(2) : '0.00',
                off6: getSidePct('offense', 6),
                off4: getSidePct('offense', 4),
                off3: getSidePct('offense', 3),
                off1: getSidePct('offense', 1),
                off7_11: `${getSidePct('offense', 7)} / ${getSidePct('offense', 11)}`,
                off0: getSidePct('offense', 0),
                sqDef: sTotals.defense.shots > 0 ? (sTotals.defense.sQual / sTotals.defense.shots).toFixed(2) : '0.00',
                rqDef: sTotals.defense.poss > 0 ? (sTotals.defense.system / sTotals.defense.poss).toFixed(2) : '0.00',
                def6: getSidePct('defense', 6),
                def4: getSidePct('defense', 4),
                def3: getSidePct('defense', 3),
                def1: getSidePct('defense', 1),
                def7_11: `${getSidePct('defense', 7)} / ${getSidePct('defense', 11)}`,
                def0: getSidePct('defense', 0)
            };
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
        // --- SURGICAL ADDITION END ---

        gameIds.forEach(id => {
            const game = rows.find(r => r.game_id === id);
            if (game.home_team === team) {
                if (game.home_score > game.away_score) wins++;
                else losses++;
            } else {
                if (game.away_score > game.home_score) wins++;
                else losses++;
            }
        });

        const offRows = rows.filter(r => (r.team_type === 'Home' && r.home_team === team) || (r.team_type === 'Away' && r.away_team === team));
        const defRows = rows.filter(r => (r.team_type === 'Home' && r.away_team === team) || (r.team_type === 'Away' && r.home_team === team));

        const off = calculateMetrics(offRows, gamesPlayed);
        const def = calculateMetrics(defRows, gamesPlayed);

        const shotTypes = [6, 4, 7, 3, 1, 0];
        const dist = { offense: { totalCount: 0, stats: {} }, defense: { totalCount: 0, stats: {} } };
        shotTypes.forEach(t => {
            dist.offense.stats[t] = { count: 0, points: 0 };
            dist.defense.stats[t] = { count: 0, points: 0 };
        });

        rows.forEach(row => {
            if (!row.system_sequence) return;
            const isOff = (row.team_type === 'Home' && row.home_team === team) || (row.team_type === 'Away' && row.away_team === team);
            const side = isOff ? 'offense' : 'defense';
            const segments = row.system_sequence.split('/').filter(s => s !== "");
            segments.forEach((seg, idx) => {
                const type = Math.floor(parseInt(seg) / 10);
                if (dist[side].stats[type]) {
                    dist[side].stats[type].count++;
                    dist[side].totalCount++;
                    if (idx === segments.length - 1) dist[side].stats[type].points += (row.points || 0);
                }
            });
        });

        res.json({
            teamName: team,
            record: `${wins}-${losses}`,
            off, 
            def,
            schedule, // Spliced cleanly into your existing payload object
            shot_margin: ((off.shots - def.shots) / gamesPlayed).toFixed(2),
            shotsGained100: (100 * (off.oRebs - off.turnovers) / (off.poss || 1)).toFixed(2),
            shotsGained100d: (100 * (def.oRebs - def.turnovers) / (def.poss || 1)).toFixed(2),
            shotDistribution: {
                offense: shotTypes.map(t => ({ type: t, pct: dist.offense.totalCount > 0 ? ((dist.offense.stats[t].count / dist.offense.totalCount) * 100).toFixed(1) + '%' : '0.0%', pps: dist.offense.stats[t].count > 0 ? (dist.offense.stats[t].points / dist.offense.stats[t].count).toFixed(3) : '0.000' })),
                defense: shotTypes.map(t => ({ type: t, pct: dist.defense.totalCount > 0 ? ((dist.defense.stats[t].count / dist.defense.totalCount) * 100).toFixed(1) + '%' : '0.0%', pps: dist.defense.stats[t].count > 0 ? (dist.defense.stats[t].points / dist.defense.stats[t].count).toFixed(3) : '0.000' }))
            }
        });
    });
});

app.get('/api/games/:id/summary', (req, res) => {
    const { id } = req.params;
    // CHANGED: Added home_score and away_score to the SELECT statement
    const sql = `
        SELECT p.*, g.home_team, g.away_team, g.home_score, g.away_score 
        FROM possessions p 
        JOIN games g ON p.game_id = g.game_id 
        WHERE p.game_id = ? AND p.system_sequence != ''`;

    db.all(sql, [id], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });

        if (rows.length === 0) return res.json({ Home: {}, Away: {} });

        // KEPT: Initializing the summary structure with team names and scores
        const summary = {
            Home: { 
                name: rows[0].home_team, 
                score: rows[0].home_score, 
                stats: { system: 0, shots: 0, totalQual: 0, poss: 0, points: 0 },
                sQual: 0, 
                shotCounts: {}, 
                shotPoints: {} 
            },
            Away: { 
                name: rows[0].away_team, 
                score: rows[0].away_score, 
                stats: { system: 0, shots: 0, totalQual: 0, poss: 0, points: 0 },
                sQual: 0, 
                shotCounts: {}, 
                shotPoints: {} 
            }
        };

        const shotTypes = [6, 4, 7, 11, 3, 1, 0];
        ['Home', 'Away'].forEach(side => {
            shotTypes.forEach(t => {
                summary[side].shotCounts[t] = 0;
                summary[side].shotPoints[t] = 0;
            });
        });

        // ADDED: Detailed event tracking loop
        rows.forEach(row => {
            const side = row.team_type; // 'Home' or 'Away'
            if (!summary[side] || !row.system_sequence) return;

            summary[side].stats.poss++; 
            summary[side].stats.points += (row.points || 0);

            const segments = row.system_sequence.split('/').filter(s => s !== "");
            
            segments.forEach((seg, idx) => {
                const type = seg === '0' ? 0 : Math.floor(parseInt(seg) / 10);
                if (summary[side].shotCounts[type] !== undefined) {
                    summary[side].shotCounts[type]++;
                    
                    if (type !== 0) {
                        summary[side].stats.shots++;
                        summary[side].sQual += type;
                    }
                    // Points only count if it's the final segment of a sequence
                    if (idx === segments.length - 1) {
                        summary[side].shotPoints[type] += (row.points || 0);
                        summary[side].stats.system += (type + (row.system_sequence.match(/\//g) || []).length);
                        summary[side].stats.totalQual += type;
                    }
                }
            });
        });

        // ADDED: Formatting helper to calculate the specific percentages and execution rates
        const finalize = (side) => {
            const t = summary[side];
            const totalEvents = shotTypes.reduce((acc, type) => acc + t.shotCounts[type], 0);
            
            const getPct = (type) => totalEvents > 0 ? ((t.shotCounts[type] / totalEvents) * 100).toFixed(1) + '%' : '0.0%';
            const getExec = (type) => t.shotCounts[type] > 0 ? (t.shotPoints[type] / t.shotCounts[type]).toFixed(3) : '0.000';

            return {
                name: t.name,
                score: t.score,
                system: t.stats.system,
                shots: t.stats.shots,
                poss: t.stats.poss,
                totalQual: t.stats.totalQual,
                sQual: t.sQual,
                // New logic for the "Possession Breakdown" table continuation
                breakdown: {
                    s6: getPct(6),
                    s4: getPct(4),
                    s7_11: `${getPct(7)} / ${getPct(11)}`,
                    s3: getPct(3),
                    s1: getPct(1),
                    s0: getPct(0)
                },
                // New logic for the "Execution" table continuation
                execution: {
                    ppp: t.stats.poss > 0 ? (t.stats.points / t.stats.poss).toFixed(3) : '0.000',
                    pps: t.stats.shots > 0 ? (t.stats.points / t.stats.shots).toFixed(3) : '0.000',
                    e6: getExec(6),
                    e4: getExec(4),
                    e7_11: `${getExec(7)} / ${getExec(11)}`,
                    e3: getExec(3),
                    e1: getExec(1),
                    e0: getExec(0)
                }
            };
        };

        res.json({ Home: finalize('Home'), Away: finalize('Away') });
    });
});

app.get('/api/system-accuracy', (req, res) => {
    // Added p.points to the query
    const sql =  `SELECT g.*, p.team_type, p.system_sequence, p.points  
        FROM games g  LEFT JOIN possessions p ON g.game_id = p.game_id`;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });

        const gamesMap = {};
        const teamStats = {}; // Tracking per-team metrics
        const shotStats = {
            6: { totalShots: 0, totalPoints: 0, pointList: [] },
            4: { totalShots: 0, totalPoints: 0, pointList: [] },
            3: { totalShots: 0, totalPoints: 0, pointList: [] },
            1: { totalShots: 0, totalPoints: 0, pointList: [] },
            7: { totalShots: 0, totalPoints: 0, pointList: [] },
            11: { totalShots: 0, totalPoints: 0, pointList: [] },
            0: { totalShots: 0, totalPoints: 0, pointList: [] }
        };

        rows.forEach(row => {
            if (!gamesMap[row.game_id]) {
                gamesMap[row.game_id] = { 
                    home_team: row.home_team, 
                    away_team: row.away_team,
                    home_actual: row.home_score, 
                    away_actual: row.away_score, 
                    home_sys: 0, 
                    away_sys: 0 
                };
            }

            if (row.system_sequence) {
                const teamName = row.team_type === 'Home' ? row.home_team : row.away_team;
                
                // Initialize teamStats if needed
                if (!teamStats[teamName]) {
                    teamStats[teamName] = { 
                        wins: 0, losses: 0, sysWins: 0, sysLosses: 0, 
                        matched: 0, mismatched: 0, totalPoints: 0, 
                        totalShots: 0, totalShotQual: 0, totalResultQual: 0, totalPoss: 0 
                    };
                }

                const segments = row.system_sequence.split('/').filter(s => s !== "");
                const shotTypes = segments.map(s => Math.floor(parseInt(s) / 10));
                
                // Aggregating for PPS and Efficiency (excluding turnovers '0' for shot counts)
                shotTypes.forEach((type, idx) => {
                    const lastIndex = shotTypes.length - 1;
                    const pts = row.points || 0;
                    
                    if (type !== 0) {
                        teamStats[teamName].totalShots++;
                        teamStats[teamName].totalShotQual += type;
                    }

                    if (shotStats[type] !== undefined) {
                        shotStats[type].totalShots++;
                        const outcome = (idx === lastIndex) ? pts : 0;
                        shotStats[type].totalPoints += outcome;
                        shotStats[type].pointList.push(outcome);
                    }
                });

                // Possession tracking for PPP
                teamStats[teamName].totalPoss++;
                teamStats[teamName].totalPoints += (row.points || 0);

                const p = parseSequence(row.system_sequence);
                if (p) {
                    const score = p.lastQuality + p.rebounds;
                    teamStats[teamName].totalResultQual += score;
                    if (row.team_type === 'Home') gamesMap[row.game_id].home_sys += score;
                    else gamesMap[row.game_id].away_sys += score;
                }
            }
        });

        // Calculate Win/Loss and Matches per Team
        Object.values(gamesMap).forEach(g => {
            const actualWinner = g.home_actual > g.away_actual ? g.home_team : g.away_team;
            const systemWinner = g.home_sys > g.away_sys ? g.home_team : g.away_team;
            const isMatch = actualWinner === systemWinner;

            // Actual Records
            if (g.home_actual > g.away_actual) { teamStats[g.home_team].wins++; teamStats[g.away_team].losses++; }
            else { teamStats[g.away_team].wins++; teamStats[g.home_team].losses++; }

            // System Records
            if (g.home_sys > g.away_sys) { teamStats[g.home_team].sysWins++; teamStats[g.away_team].sysLosses++; }
            else { teamStats[g.away_team].sysWins++; teamStats[g.home_team].sysLosses++; }

            // Matches
            [g.home_team, g.away_team].forEach(name => {
                if (isMatch) teamStats[name].matched++;
                else teamStats[name].mismatched++;
            });
        });

        // Format Team Accuracy Table
        const teamTable = Object.keys(teamStats).map(name => {
            const s = teamStats[name];
            const expPPS = s.totalShots > 0 ? (s.totalShotQual / 4) / s.totalShots : 0;
            const actPPS = s.totalShots > 0 ? s.totalPoints / s.totalShots : 0;
            const expPPP = s.totalPoss > 0 ? (s.totalResultQual / 4) / s.totalPoss : 0;
            const actPPP = s.totalPoss > 0 ? s.totalPoints / s.totalPoss : 0;

            return {
                name,
                record: `${s.wins}-${s.losses}`,
                sysRecord: `${s.sysWins}-${s.sysLosses}`,
                gb: s.sysWins - s.wins,
                matched: s.matched,
                mismatched: s.mismatched,
                expectedPPS: expPPS.toFixed(3),
                actualPPS: actPPS.toFixed(3),
                ppsDiff: (actPPS - expPPS).toFixed(3),
                expectedPPP: expPPP.toFixed(3),
                actualPPP: actPPP.toFixed(3),
                pppDiff: (actPPP - expPPP).toFixed(3)
            };
        });

        const shotTable = [6, 4, 3, 1, 7, 11, 0].map(type => {
            const stats = shotStats[type];
            const actual = stats.totalShots > 0 ? (stats.totalPoints / stats.totalShots) : 0;
            const expected = type / 4;
            let rsd = 0;
            if (stats.pointList.length > 1 && actual > 0) {
                const variance = stats.pointList.reduce((acc, p) => acc + Math.pow(p - actual, 2), 0) / stats.pointList.length;
                rsd = (Math.sqrt(variance) / actual);
            }
            return {
                type: type + "'s",
                actual: actual.toFixed(3),
                expected: expected.toFixed(3),
                diff: (actual - expected).toFixed(3),
                rsd: (rsd * 100).toFixed(1) + "%"
            };
        });

        const games = Object.values(gamesMap);
        let matches = 0, conservative = 0, aggressive = 0;
        games.forEach(g => {
            const isMatch = (g.home_actual > g.away_actual === g.home_sys > g.away_sys);
            const diff = Math.abs(g.home_sys - g.away_sys);
            if (isMatch) matches++;
            if (isMatch && diff > 10) conservative++;
            if (isMatch || (!isMatch && diff <= 10)) aggressive++;
        });

        const rawDifferentials = Object.values(gamesMap).map(g => {
            const actualWinner = g.home_actual > g.away_actual ? 'Home' : 'Away';
            const systemWinner = g.home_sys > g.away_sys ? 'Home' : 'Away';
            
            // We want the system score differential from the perspective of the ACTUAL winner
            // to see if higher system scores correlate with actual wins.
            const actualWinnerSysScore = actualWinner === 'Home' ? g.home_sys : g.away_sys;
            const actualLoserSysScore = actualWinner === 'Home' ? g.away_sys : g.home_sys;
            const systemDiff = actualWinnerSysScore - actualLoserSysScore;

            return {
                gameId: g.game_id,
                systemDiff: systemDiff,
                systemCorrect: actualWinner === systemWinner
            };
        });

        res.json({
            total: games.length,
            standard: { count: matches, pct: games.length > 0 ? ((matches / games.length) * 100).toFixed(1) : 0 },
            conservative: { count: conservative, pct: games.length > 0 ? ((conservative / games.length) * 100).toFixed(1) : 0 },
            aggressive: { count: aggressive, pct: games.length > 0 ? ((aggressive / games.length) * 100).toFixed(1) : 0 },
            shotTable,
            teamTable, 
            rawDifferentials
        });
    });
});

// ==========================================
// LEAGUE LEADERBOARDS ENDPOINT
// ==========================================
// ==========================================
// LEAGUE LEADERBOARDS ENDPOINT
// ==========================================
// ==========================================
// LEAGUE LEADERBOARDS ENDPOINT
// ==========================================
app.get('/api/league/summary', (req, res) => {
    db.all("SELECT * FROM games ORDER BY date DESC", [], (err, gamesRows) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!gamesRows || gamesRows.length === 0) return res.json([]);
        
        const posSql = `
            SELECT p.*, g.home_team, g.away_team, g.home_score, g.away_score 
            FROM possessions p 
            JOIN games g ON p.game_id = g.game_id 
            WHERE p.system_sequence IS NOT NULL AND p.system_sequence != ''`;
            
        db.all(posSql, [], (err, possessionsRows) => {
            if (err) return res.status(400).json({ error: err.message });

            const uniqueTeams = new Set();
            gamesRows.forEach(g => {
                if (g.home_team) uniqueTeams.add(g.home_team);
                if (g.away_team) uniqueTeams.add(g.away_team);
            });

            const recordsMap = {};
            uniqueTeams.forEach(t => {
                recordsMap[t] = { wins: 0, losses: 0, sysWins: 0, sysLosses: 0, gamesPlayed: 0 };
            });

            const gameScoresMap = {};
            possessionsRows.forEach(row => {
                if (!gameScoresMap[row.game_id]) {
                    gameScoresMap[row.game_id] = {
                        Home: { name: row.home_team, sysScore: 0 },
                        Away: { name: row.away_team, sysScore: 0 }
                    };
                }
                const p = parseSequence(row.system_sequence);
                if (p) {
                    gameScoresMap[row.game_id][row.team_type].sysScore += (p.lastQuality + p.rebounds);
                }
            });

            gamesRows.forEach(g => {
                const h = g.home_team;
                const a = g.away_team;
                if (!recordsMap[h] || !recordsMap[a]) return;

                recordsMap[h].gamesPlayed++;
                recordsMap[a].gamesPlayed++;

                if (g.home_score > g.away_score) {
                    recordsMap[h].wins++; recordsMap[a].losses++;
                } else {
                    recordsMap[a].wins++; recordsMap[h].losses++;
                }

                const sysGame = gameScoresMap[g.game_id];
                if (sysGame) {
                    if (sysGame.Home.sysScore > sysGame.Away.sysScore) {
                        recordsMap[h].sysWins++; recordsMap[a].sysLosses++;
                    } else if (sysGame.Away.sysScore > sysGame.Home.sysScore) {
                        recordsMap[a].sysWins++; recordsMap[h].sysLosses++;
                    }
                }
            });

            const leagueSummary = Array.from(uniqueTeams).map(team => {
                const rec = recordsMap[team];
                const gp = rec.gamesPlayed || 1;

                // 1. Filter possessions relative to the active team
                const offRows = possessionsRows.filter(r => (r.team_type === 'Home' && r.home_team === team) || (r.team_type === 'Away' && r.away_team === team));
                const defRows = possessionsRows.filter(r => (r.team_type === 'Home' && r.away_team === team) || (r.team_type === 'Away' && r.home_team === team));

                const offMetrics = calculateMetrics(offRows, gp);
                const defMetrics = calculateMetrics(defRows, gp);

                // 2. Shot margin calculations matching Team tab formulas
                const totalOffShots = offMetrics.shots || 0;
                const totalDefShots = defMetrics.shots || 0;
                const shotMarginG = ((totalOffShots - totalDefShots) / gp);
                
                const shotsGained100Off = offMetrics.poss > 0 ? ((offMetrics.shots - (offMetrics.poss * 0.74)) / offMetrics.poss) * 100 : 0;
                const shotsGained100Def = defMetrics.poss > 0 ? ((defMetrics.shots - (defMetrics.poss * 0.74)) / defMetrics.poss) * 100 : 0;

                // 3. Complete Shot type % and PPS distribution calculations
                const getShotTypeData = (rows) => {
                    const counts = { 6: 0, 4: 0, 7: 0, 11: 0, 3: 0, 1: 0, 0: 0 };
                    const pointsMap = { 6: 0, 4: 0, 7: 0, 11: 0, 3: 0, 1: 0, 0: 0 };
                    let totalShots = 0;

                    rows.forEach(row => {
                        if (!row.system_sequence) return;
                        const segments = row.system_sequence.split('/').filter(s => s !== "");
                        segments.forEach(seg => {
                            const type = seg === '0' ? 0 : Math.floor(parseInt(seg) / 10);
                            if (counts[type] !== undefined) {
                                counts[type]++;
                                if (type !== 0) totalShots++;
                            }
                        });
                        // Track execution totals if points exist
                        const lastSeg = segments[segments.length - 1];
                        if (lastSeg) {
                            const lastType = lastSeg === '0' ? 0 : Math.floor(parseInt(lastSeg) / 10);
                            if (pointsMap[lastType] !== undefined) {
                                pointsMap[lastType] += (row.points || 0);
                            }
                        }
                    });

                    const shotTypes = [6, 4, 7, 3, 1, 0];
                    return shotTypes.map(t => {
                        let pctValue = 0;
                        if (t === 0) {
                            // Turnover percentage is relative to total possessions
                            pctValue = rows.length > 0 ? (counts[0] / rows.length) * 100 : 0;
                        } else if (t === 7) {
                            // Combine 7s and 11s into one structural data cell matching your metrics logs
                            const combinedCount = counts[7] + counts[11];
                            pctValue = totalShots > 0 ? (combinedCount / totalShots) * 100 : 0;
                        } else {
                            pctValue = totalShots > 0 ? (counts[t] / totalShots) * 100 : 0;
                        }

                        let ppsValue = 0;
                        if (t === 7) {
                            const combinedCount = counts[7] + counts[11];
                            const combinedPoints = pointsMap[7] + pointsMap[11];
                            ppsValue = combinedCount > 0 ? combinedPoints / combinedCount : 0;
                        } else {
                            ppsValue = counts[t] > 0 ? pointsMap[t] / counts[t] : 0;
                        }

                        return {
                            pct: pctValue.toFixed(1) + '%',
                            pps: ppsValue.toFixed(2)
                        };
                    });
                };

                return {
                    teamName: team,
                    record: `${rec.wins}-${rec.losses}`,
                    systemRecord: `${rec.sysWins}-${rec.sysLosses}`,
                    offense: {
                        sysG: parseFloat(offMetrics.sysG),
                        shotMargin: shotMarginG >= 0 ? `+${shotMarginG.toFixed(1)}` : shotMarginG.toFixed(1),
                        possG: parseFloat(offMetrics.possG),
                        shotsGained: parseFloat(shotsGained100Off.toFixed(1)),
                        result_q: parseFloat(offMetrics.result_q),
                        shot_q: parseFloat(offMetrics.shot_q),
                        stint_q: parseFloat(offMetrics.stint_q),
                        oRebPct: offMetrics.oRebPct,
                        ftRebG: parseFloat(offMetrics.ftRebG),
                        distribution: getShotTypeData(offRows) // Array sequence [6s, 4s, 7s/11s, 3s, 1s, 0s]
                    },
                    defense: {
                        sysG: parseFloat(defMetrics.sysG),
                        shotMargin: shotMarginG >= 0 ? `-${shotMarginG.toFixed(1)}` : `+${Math.abs(shotMarginG).toFixed(1)}`, // Inverted team defensive perspective
                        possG: parseFloat(defMetrics.possG),
                        shotsGained: parseFloat(shotsGained100Def.toFixed(1)),
                        result_q: parseFloat(defMetrics.result_q),
                        shot_q: parseFloat(defMetrics.shot_q),
                        stint_q: parseFloat(defMetrics.stint_q),
                        oRebPct: defMetrics.oRebPct,
                        ftRebG: parseFloat(defMetrics.ftRebG),
                        distribution: getShotTypeData(defRows)
                    }
                };
            });

            res.json(leagueSummary);
        });
    });
});

app.get('*catchall', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});