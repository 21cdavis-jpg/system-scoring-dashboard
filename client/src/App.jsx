import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './App.css';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://shot-quality-scoring-system.onrender.com';

function SystemDifferentialChart({ rawData }) {
  const [binSize, setBinSize] = useState(10);

  const binnedData = useMemo(() => {
    // Hard target safety check against unpopulated or broken payloads
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    // Double-check every underlying index object has structural integrity
    const safeData = rawData.filter(d => d && typeof d.systemDiff === 'number');
    if (safeData.length === 0) return [];

    const maxDiff = Math.max(...safeData.map(d => Math.abs(d.systemDiff)), 10);
    const totalBins = Math.ceil(maxDiff / binSize);
    
    const bins = Array.from({ length: totalBins }, (_, i) => {
      const min = i * binSize;
      const max = min + binSize - 1;
      return { min, max, label: `${min}-${max}`, correctCount: 0, totalCount: 0 };
    });

    safeData.forEach(game => {
      const diff = Math.abs(game.systemDiff); 
      const targetBin = bins.find(b => diff >= b.min && diff <= b.max);
      if (targetBin) {
        targetBin.totalCount++;
        if (game.systemCorrect) targetBin.correctCount++;
      }
    });

    return bins
      .map(b => ({
        range: b.label,
        "Win Probability": b.totalCount > 0 ? Math.round((b.correctCount / b.totalCount) * 100) : 0,
        "Game Count": b.totalCount
      }))
      .filter(b => b["Game Count"] > 0);
  }, [rawData, binSize]);

  // Note: While transitioning to Chakra UI, you can temporarily use standard HTML/CSS styling 
  // so your build doesn't break if Chakra isn't fully configured yet.
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', maxWidth: '800px', margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ margin: 0 }}>Win Probability by System Differential</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>How predictive is the SQ/RQ scoring gap?</p>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginRight: '5px' }}>BIN SIZE: </label>
          <select value={binSize} onChange={(e) => setBinSize(Number(e.target.value))} style={{ padding: '4px', borderRadius: '4px' }}>
            {[5, 10, 15, 20, 25].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>

      {/* FIXED: Gave the wrapper an explicit height and width for the responsive container */}
      <div style={{ height: '350px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={binnedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="range" stroke="#718096" fontSize={12} tickLine={false} />
            <YAxis stroke="#718096" fontSize={12} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip 
              cursor={{ fill: '#EDF2F7', opacity: 0.4 }}
              formatter={(value, name) => [name === "Win Probability" ? `${value}%` : value, name]}
            />
            <Bar dataKey="Win Probability" fill="#16a085" radius={[4, 4, 0, 0]} barSize={45} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Helper sub-component for handling client sorting configurations natively
function SortableLeagueTable({ data, columns, initialSortKey }) {
  const [sortConfig, setSortConfig] = useState({ key: initialSortKey, direction: 'desc' });

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        // Evaluate deeper object path nesting if specified (e.g. 'offense.shot_q')
        const getNestedValue = (obj, path) => {
          return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        };

        let aVal = getNestedValue(a, sortConfig.key);
        let bVal = getNestedValue(b, sortConfig.key);

        // Standard string formatting strips for clean percentages calculations
        if (typeof aVal === 'string' && aVal.endsWith('%')) aVal = parseFloat(aVal);
        if (typeof bVal === 'string' && bVal.endsWith('%')) bVal = parseFloat(bVal);

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div style={{ overflowX: 'auto', marginBottom: '35px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', borderRadius: '6px' }}>
      <table className="play-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
            {columns.map((col) => (
              <th 
                key={col.key} 
                onClick={() => col.sortable !== false && requestSort(col.key)}
                style={{ 
                  padding: '10px', 
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  userSelect: 'none',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  borderBottom: '3px solid #1abc9c'
                }}
              >
                {col.label} {sortConfig.key === col.key ? (sortConfig.direction === 'desc' ? '🔽' : '🔼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9', textAlign: 'center' }}>
              {columns.map((col) => {
                const getNestedValue = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
                const rawVal = getNestedValue(row, col.key);
                return (
                  <td key={col.key} style={{ padding: '8px', fontSize: '0.85rem', borderBottom: '1px solid #e0e0e0' }}>
                    {typeof rawVal === 'number' && !col.key.includes('Record') ? rawVal.toFixed(col.decimals ?? 2) : rawVal}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('System');
  const [gameData, setGameData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plays, setPlays] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeamStats, setSelectedTeamStats] = useState(null);
  const [gameSummary, setGameSummary] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  // Add these inside function App() right alongside your other useState hooks
  const [leagueSummary, setLeagueSummary] = useState([]);
  const [leagueLoading, setLeagueLoading] = useState(false);

  // Add this inside your existing hooks or append as a new dedicated useEffect 
  useEffect(() => {
    if (activeTab === 'League') {
      setLeagueLoading(true);
      axios.get(`${API_BASE_URL}/api/league/summary`)
        .then(res => {
          setLeagueSummary(res.data);
          setLeagueLoading(false);
        })
        .catch(err => {
          console.error("Error retrieving league dashboards:", err);
          setLeagueLoading(false);
        });
    }
  }, [activeTab]);

  const fetchPlays = (gameId) => {
    if (!gameId) return;
    axios.get(`${API_BASE_URL}/api/games/${gameId}/plays`)
      .then(res => setPlays(res.data))
      .catch(err => console.error("Error fetching plays:", err));
  };

  const fetchTeamStats = (teamName) => {
    if (!teamName) {
      setSelectedTeamStats(null);
      return;
    }
    axios.get(`${API_BASE_URL}/api/stats/${teamName}`)
      .then(res => {
        console.log("Data received:", res.data);
        setSelectedTeamStats(res.data);
      })
      .catch(err => console.error("API Error:", err));
  };

  const fetchGameSummary = (gameId) => {
    if (!gameId) return;
    axios.get(`${API_BASE_URL}/api/games/${gameId}/summary`)
      .then(res => setGameSummary(res.data))
      .catch(err => console.error("Summary error:", err));
  };

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/games`)
      .then(res => {
        const gamesArray = Array.isArray(res.data) 
          ? res.data 
          : (res.data.games || []);

        setGameData(res.data);
        setLoading(false);
        
        const teams = new Set();
        res.data.forEach(g => {
          teams.add(g.home_team);
          teams.add(g.away_team);
        });
        setAllTeams(Array.from(teams).sort());
      })
      .catch(err => {
        console.error("Initialization error:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'System' && !systemStats) {
      axios.get(`${API_BASE_URL}/api/system-accuracy`)
        .then(res => {
          setSystemStats(res.data);
        })
        .catch(err => {
          console.error("System Tab Error:", err);
        }); 
    }
  }, [activeTab, systemStats]);

  // Helper helper to parse sequence strings into useful objects
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

  // Process data for the "Scoring by Period" Table
  const getScoringByPeriod = () => {
    const validPlays = plays.filter(p => p.system_sequence && p.system_sequence.trim() !== "");
    const periods = {};

    const initTeamStats = () => ({ poss: 0, system: 0, shots: 0, totalQual: 0 });

    validPlays.forEach(play => {
      const per = play.period;
      const team = play.team_type; // 'Home' or 'Away'
      
      if (!periods[per]) {
        periods[per] = { Home: initTeamStats(), Away: initTeamStats() };
      }

      const pData = parseSequence(play.system_sequence);
      if (pData) {
        periods[per][team].poss++;
        periods[per][team].system += (pData.lastQuality + pData.rebounds);
        pData.events.forEach(e => {
          if (e.type === 'shot') {
            periods[per][team].shots++;
            periods[per][team].totalQual += e.quality;
          }
        });
      }
    });

    return Object.keys(periods).sort((a, b) => a - b).map(per => {
      let label = `${per}st`;
      if (per === '2') label = '2nd';
      if (parseInt(per) >= 3) label = `OT${parseInt(per) - 2}`;

      return {
        period: label,
        Home: periods[per].Home,
        Away: periods[per].Away
      };
    });
  };

  // Process data for the "Scoring by Possessions" Table
  const getScoringByPossessions = () => {
    const validPlays = plays.filter(p => p.system_sequence && p.system_sequence.trim() !== "");
    
    // Definition of the chunks
    const bins = [
      { min: 1, max: 20, label: '1-20' },
      { min: 21, max: 40, label: '21-40' },
      { min: 41, max: 60, label: '41-60' },
      { min: 61, max: 80, label: '61-80' },
      { min: 81, max: 100, label: '81-100' },
      { min: 101, max: 120, label: '101-120' },
      { min: 121, max: 140, label: '121-140' },
      { min: 141, max: 160, label: '141-160' },
      { min: 161, max: 180, label: '161-180' },
      { min: 181, max: 200, label: '181-200' },
      { min: 201, max: 999, label: '200+' }
    ];

    const initTeamStats = () => ({ poss: 0, system: 0, shots: 0, totalQual: 0 });
    const binnedData = bins.map(b => ({ label: b.label, Home: initTeamStats(), Away: initTeamStats(), hasData: false }));

    validPlays.forEach((play, index) => {
      const chronologicalCount = index + 1; 
      const team = play.team_type;

      const targetBin = bins.findIndex(b => chronologicalCount >= b.min && chronologicalCount <= b.max);
      if (targetBin !== -1) {
        binnedData[targetBin].hasData = true;
        const pData = parseSequence(play.system_sequence);
        if (pData) {
          binnedData[targetBin][team].poss++;
          binnedData[targetBin][team].system += (pData.lastQuality + pData.rebounds);
          pData.events.forEach(e => {
            if (e.type === 'shot') {
              binnedData[targetBin][team].shots++;
              binnedData[targetBin][team].totalQual += e.quality;
            }
          });
        }
      }
    });

    return binnedData.filter(b => b.hasData);
  };

  const periodStats = getScoringByPeriod();
  const possessionStats = getScoringByPossessions();

  // Compute Total metrics for the period summary footer row
  const totalPeriodHome = periodStats.reduce((acc, curr) => {
    acc.poss += curr.Home.poss; acc.system += curr.Home.system; acc.shots += curr.Home.shots; acc.totalQual += curr.Home.totalQual;
    return acc;
  }, { poss: 0, system: 0, shots: 0, totalQual: 0 });

  const totalPeriodAway = periodStats.reduce((acc, curr) => {
    acc.poss += curr.Away.poss; acc.system += curr.Away.system; acc.shots += curr.Away.shots; acc.totalQual += curr.Away.totalQual;
    return acc;
  }, { poss: 0, system: 0, shots: 0, totalQual: 0 });

  return (
    <div className="App">
      <header>
        <h1>Shot Quality Scoring System Dashboard</h1>
        <nav>
          {['System', 'Team', 'Games', 'League'].map(tab => (
            <button 
              key={tab} 
              className={activeTab === tab ? 'active' : ''} 
              onClick={() => {
                setActiveTab(tab);
                setPlays([]); 
                setGameSummary(null);
                setSelectedTeamStats(null);
              }}
            >
              {tab}
            </button>
          ))}
        </nav> {/* Ensure only ONE closing nav tag is present here */}
      </header>

      <main>
        {activeTab === 'Games' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Top Row: Game Picker */}
            <div style={{ width: '300px' }}>
              <select style={{ width: '100%', padding: '8px', borderRadius: '4px' }} onChange={(e) => {
                  fetchPlays(e.target.value); 
                  fetchGameSummary(e.target.value); }}>
                <option value="">Select a Game</option>
                {gameData.map(game => (
                  <option key={game.game_id} value={game.game_id}>
                    {game.date} - {game.home_team} vs {game.away_team}
                  </option>
                ))}
              </select>
            </div>

            {/* Three-Column Grid System layout to optimize your workspace */}
            <div style={{ display: 'flex', gap: '3px'}}>
            {/* Heading stays completely external and stationary */}
              
              {/* Column 1: Traditional Play-By-Play */}
              <div style={{ 
                maxHeight: '800px', // Matches the typical height of your other dashboard tables
                overflowY: 'auto',   // Enables vertical scrolling
                overflowX: 'auto',   // Prevents layout breaking on small screens
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginTop: '15px',
                fontSize: '0.8rem'
              }}>
              
                
                {plays.length > 0 ? (
                  <table className="play-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                    {/* --- FROZEN HEADER --- */}
                    <thead style={{ 
                      position: 'sticky', 
                      top: 0, 
                      backgroundColor: '#2c3e50', 
                      color: 'white',
                      zIndex: 1 // Keeps the header floating above scrolling rows
                    }}>
                      <tr>
                        <th style={{ padding: '3px', textAlign: 'center', borderBottom: '2px solid #1abc9c', fontSize: '0.85rem' }}>Period</th>
                        <th style={{ padding: '3px', textAlign: 'center', borderBottom: '2px solid #1abc9c', fontSize: '0.85rem' }}>Team</th>
                        <th style={{ padding: '3px', textAlign: 'center', borderBottom: '2px solid #1abc9c', fontSize: '0.85rem' }}>Sequence</th>
                        <th style={{ padding: '3px', textAlign: 'center', borderBottom: '2px solid #1abc9c', fontSize: '0.85rem' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plays.map((play, index) => {
                        const currentGame = gameData.find(g => g.game_id === play.game_id);
                        const teamName = play.team_type === 'Home' 
                          ? (currentGame?.home_team || 'Home') 
                          : (currentGame?.away_team || 'Away');

                        return (
                          <tr key={index} style={play.system_sequence === "" ? { opacity: 0.4, backgroundColor: '#fcfcfc' } : {}}>
                            <td>{play.period}</td>
                            <td className="team-badge" style={{fontSize: '0.7rem'}}>{teamName}</td>
                            <td>{play.system_sequence || '—'}</td>
                            <td>{play.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>Select a game above to view data.</p>
                )}
              </div>

              {/* Column 2: NEW Split-Row Intermediate Statistical Tables */}
              {plays.length > 0 && (
                <div style={{ flex: 1.8, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Table A: Scoring by Period */}
                  <div>
                    <h3 style={{ margin: '0 0 10px 0' }}>Scoring by Period</h3>
                    <table className="play-table" style={{ width: '100%' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                          <th>Period</th>
                          <th>Team</th>
                          <th>Poss.</th>
                          <th>System Score</th>
                          <th>Shot Margin</th>
                          <th>Shot Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodStats.map((row, idx) => (
                          <React.Fragment key={idx}>
                            {/* Home Team Row */}
                            <tr style={{ borderTop: '2px solid #ccc' }}>
                              <td rowSpan="2" style={{ fontWeight: 'bold', verticalAlign: 'middle', backgroundColor: '#fafafa', borderRight: '1px solid #ddd' }}>{row.period}</td>
                              <td style={{ fontWeight: '500' }}>Home</td>
                              <td>{row.Home.poss}</td>
                              <td>{row.Home.system.toFixed(0)}</td>
                              <td>{(row.Home.shots - row.Away.shots) >= 0 ? `+${row.Home.shots - row.Away.shots}` : row.Home.shots - row.Away.shots}</td>
                              <td>{row.Home.shots > 0 ? (row.Home.totalQual / row.Home.shots).toFixed(2) : '0.00'}</td>
                            </tr>
                            {/* Away Team Row */}
                            <tr style={{ backgroundColor: '#f9f9f9' }}>
                              <td style={{ fontWeight: '500' }}>Away</td>
                              <td>{row.Away.poss}</td>
                              <td>{row.Away.system.toFixed(0)}</td>
                              <td>{(row.Away.shots - row.Home.shots) >= 0 ? `+${row.Away.shots - row.Home.shots}` : row.Away.shots - row.Home.shots}</td>
                              <td>{row.Away.shots > 0 ? (row.Away.totalQual / row.Away.shots).toFixed(2) : '0.00'}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                        {/* Summary Accumulation Footer Row */}
                        <tr style={{ borderTop: '3px double #2c3e50', fontWeight: 'bold', backgroundColor: '#eaeded' }}>
                          <td rowSpan="2" style={{ verticalAlign: 'middle', borderRight: '1px solid #ddd' }}>Total</td>
                          <td>Home</td>
                          <td>{totalPeriodHome.poss}</td>
                          <td>{totalPeriodHome.system.toFixed(0)}</td>
                          <td>{(totalPeriodHome.shots - totalPeriodAway.shots) >= 0 ? `+${totalPeriodHome.shots - totalPeriodAway.shots}` : totalPeriodHome.shots - totalPeriodAway.shots}</td>
                          <td>{totalPeriodHome.shots > 0 ? (totalPeriodHome.totalQual / totalPeriodHome.shots).toFixed(2) : '0.00'}</td>
                        </tr>
                        <tr style={{ fontWeight: 'bold', backgroundColor: '#eaeded' }}>
                          <td>Away</td>
                          <td>{totalPeriodAway.poss}</td>
                          <td>{totalPeriodAway.system.toFixed(0)}</td>
                          <td>{(totalPeriodAway.shots - totalPeriodHome.shots) >= 0 ? `+${totalPeriodAway.shots - totalPeriodHome.shots}` : totalPeriodAway.shots - totalPeriodHome.shots}</td>
                          <td>{totalPeriodAway.shots > 0 ? (totalPeriodAway.totalQual / totalPeriodAway.shots).toFixed(2) : '0.00'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table B: Scoring by Possessions */}
                  <div>
                    <h3 style={{ margin: '0 0 6px 0' }}>Scoring by Possessions</h3>
                    <table className="play-table" style={{ width: '100%' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                          <th>Poss.</th>
                          <th>Team</th>
                          <th>Poss.</th>
                          <th>System Score</th>
                          <th>Shot Margin</th>
                          <th>Shot Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {possessionStats.map((row, idx) => (
                          <React.Fragment key={idx}>
                            {/* Home Row */}
                            <tr style={{ borderTop: '2px solid #ccc' }}>
                              <td rowSpan="2" style={{ fontWeight: 'bold', verticalAlign: 'middle', backgroundColor: '#fafafa', borderRight: '1px solid #ddd', fontSize: '0.8rem' }}>{row.label}</td>
                              <td style={{ fontWeight: '500', fontSize: '0.8rem' }}>Home</td>
                              <td>{row.Home.poss}</td>
                              <td>{row.Home.system.toFixed(0)}</td>
                              <td>{(row.Home.shots - row.Away.shots) >= 0 ? `+${row.Home.shots - row.Away.shots}` : row.Home.shots - row.Away.shots}</td>
                              <td>{row.Home.shots > 0 ? (row.Home.totalQual / row.Home.shots).toFixed(2) : '0.00'}</td>
                            </tr>
                            {/* Away Row */}
                            <tr style={{ backgroundColor: '#f9f9f9' }}>
                              <td style={{ fontWeight: '500', fontSize: '0.8rem' }}>Away</td>
                              <td>{row.Away.poss}</td>
                              <td>{row.Away.system.toFixed(0)}</td>
                              <td>{(row.Away.shots - row.Home.shots) >= 0 ? `+${row.Away.shots - row.Home.shots}` : row.Away.shots - row.Home.shots}</td>
                              <td>{row.Away.shots > 0 ? (row.Away.totalQual / row.Away.shots).toFixed(2) : '0.00'}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

              {/* Column 3: Existing Game Summary Sidebar */}
              {gameSummary && (
                <div style={{ flex: 1, backgroundColor: '#f4f4f4', padding: '5px', borderRadius: '8px', height: 'fit-content' }}>
                  <h3>Game Summary</h3>
                  <table className="play-table" style={{ width: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '120px', textAlign: 'center' }}>Metric</th>
                        <th>Home</th>
                        <th>Away</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ fontWeight: 'bold', backgroundColor: '#eee' }}>
                        <td>Team</td>
                        <td>{gameSummary.Home.name}</td>
                        <td>{gameSummary.Away.name}</td>
                      </tr>
                      <tr>
                        <td>System Score</td>
                        <td>{gameSummary.Home.system}</td>
                        <td>{gameSummary.Away.system}</td>
                      </tr>
                      <tr>
                        <td>Shot Margin</td>
                        <td>
                          {gameSummary.Home.shots - gameSummary.Away.shots > 0 
                            ? `+${gameSummary.Home.shots - gameSummary.Away.shots}` 
                            : gameSummary.Home.shots - gameSummary.Away.shots}
                        </td>
                        <td>
                          {gameSummary.Away.shots - gameSummary.Home.shots > 0 
                            ? `+${gameSummary.Away.shots - gameSummary.Home.shots}` 
                            : gameSummary.Away.shots - gameSummary.Home.shots}
                        </td>
                      </tr>
                      <tr>
                        <td>Shot Quality</td>
                        <td>{(gameSummary.Home.sQual / (gameSummary.Home.shots || 1)).toFixed(3)}</td>
                        <td>{(gameSummary.Away.sQual / (gameSummary.Away.shots || 1)).toFixed(3)}</td>
                      </tr>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap' }}>Result Quality</td>
                        <td>{(gameSummary.Home.system / (gameSummary.Home.poss || 1)).toFixed(3)}</td>
                        <td>{(gameSummary.Away.system / (gameSummary.Away.poss || 1)).toFixed(3)}</td>
                      </tr>

                      <tr style={{ backgroundColor: '#2c3e50', color: 'white', fontWeight: 'bold' }}>
                        <td colSpan="3" style={{ textAlign: 'center' }}>Possession Breakdown</td>
                      </tr>
                      <tr>
                        <td>Possessions</td>
                        <td>{gameSummary.Home.poss}</td>
                        <td>{gameSummary.Away.poss}</td>
                      </tr>
                      <tr><td>6%</td><td>{gameSummary.Home.breakdown.s6}</td><td>{gameSummary.Away.breakdown.s6}</td></tr>
                      <tr><td>4%</td><td>{gameSummary.Home.breakdown.s4}</td><td>{gameSummary.Away.breakdown.s4}</td></tr>
                      <tr><td>7%/11%</td><td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{gameSummary.Home.breakdown.s7_11}</td><td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{gameSummary.Away.breakdown.s7_11}</td></tr>
                      <tr><td>3%</td><td>{gameSummary.Home.breakdown.s3}</td><td>{gameSummary.Away.breakdown.s3}</td></tr>
                      <tr><td>1%</td><td>{gameSummary.Home.breakdown.s1}</td><td>{gameSummary.Away.breakdown.s1}</td></tr>
                      <tr><td>0%</td><td>{gameSummary.Home.breakdown.s0}</td><td>{gameSummary.Away.breakdown.s0}</td></tr>

                      <tr style={{ backgroundColor: '#2c3e50', color: 'white', fontWeight: 'bold' }}>
                        <td colSpan="3" style={{ textAlign: 'center' }}>Execution</td>
                      </tr>
                      <tr>
                        <td>Real Score</td>
                        <td style={{ fontWeight: 'bold' }}>{gameSummary.Home.score}</td>
                        <td style={{ fontWeight: 'bold' }}>{gameSummary.Away.score}</td>
                      </tr>
                      <tr>
                        <td>PPP</td>
                        <td>{gameSummary.Home.execution.ppp}</td>
                        <td>{gameSummary.Away.execution.ppp}</td>
                      </tr>
                      <tr>
                        <td>PPS</td>
                        <td>{gameSummary.Home.execution.pps}</td>
                        <td>{gameSummary.Away.execution.pps}</td>
                      </tr>
                      <tr><td>6 Exec.</td><td>{gameSummary.Home.execution.e6}</td><td>{gameSummary.Away.execution.e6}</td></tr>
                      <tr><td>4 Exec.</td><td>{gameSummary.Home.execution.e4}</td><td>{gameSummary.Away.execution.e4}</td></tr>
                      <tr><td>7/11 Exec.</td><td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{gameSummary.Home.execution.e7_11}</td><td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{gameSummary.Away.execution.e7_11}</td></tr>
                      <tr><td>3 Exec.</td><td>{gameSummary.Home.execution.e3}</td><td>{gameSummary.Away.execution.e3}</td></tr>
                      <tr><td>1 Exec.</td><td>{gameSummary.Home.execution.e1}</td><td>{gameSummary.Away.execution.e1}</td></tr>
                      <tr><td>0 Exec.</td><td>{gameSummary.Home.execution.e0}</td><td>{gameSummary.Away.execution.e0}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
        
        {activeTab === 'Team' && (
          <section>
            <select onChange={(e) => fetchTeamStats(e.target.value)}>
              <option value="">Select a Team</option>
              {allTeams.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
            
            {selectedTeamStats && (
              <>
                <div style={{ marginTop: '20px' }}>
                  <h3>{selectedTeamStats.teamName} ({selectedTeamStats.record})</h3>
                  <h3>Team Performance Summary</h3>
                  <table className="play-table">
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th>Side</th>
                        <th>System Score</th>
                        <th>Shot Margin</th>
                        <th>Possessions</th>
                        <th>Shots Gained</th>
                        <th>Result Quality</th>
                        <th>Shot Quality</th>
                        <th>Stint Quality</th>
                        <th>OREB%</th>
                        <th>FT REB</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Offense</td>
                        <td>{selectedTeamStats.off.sysG}</td>
                        <td rowSpan="2">{selectedTeamStats.shot_margin}</td>
                        <td>{selectedTeamStats.off.possG}</td>
                        <td>{selectedTeamStats.shotsGained100}</td>
                        <td>{selectedTeamStats.off.result_q}</td>
                        <td>{selectedTeamStats.off.shot_q}</td>
                        <td>{selectedTeamStats.off.stint_q}</td>
                        <td>{selectedTeamStats.off.oRebPct}</td>
                        <td>{selectedTeamStats.off.ftRebG}</td>
                      </tr>
                      <tr>
                        <td>Defense</td>
                        <td>{selectedTeamStats.def.sysG}</td>
                        <td>{selectedTeamStats.def.possG}</td>
                        <td>{selectedTeamStats.shotsGained100d}</td>
                        <td>{selectedTeamStats.def.result_q}</td>
                        <td>{selectedTeamStats.def.shot_q}</td>
                        <td>{selectedTeamStats.def.stint_q}</td>
                        <td>{selectedTeamStats.def.oRebPct}</td>
                        <td>{selectedTeamStats.def.ftRebG}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '40px' }}>
                  <h3 style={{ marginBottom: '20px' }}>Team Shot Type Breakdown</h3>
                  <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th style={{ border: '1px solid #ddd' }}></th>
                        <th colSpan="2" style={{ border: '1px solid #ddd' }}>6's (Exp. PPS: 1.50)</th>
                        <th colSpan="2" style={{ border: '1px solid #ddd' }}>4's (Exp. PPS: 1.00)</th>
                        <th colSpan="2" style={{ border: '1px solid #ddd' }}>7's (Exp. PPS: 1.75)</th>
                        <th colSpan="2" style={{ border: '1px solid #ddd' }}>3's (Exp. PPS: 0.75)</th>
                        <th colSpan="2" style={{ border: '1px solid #ddd' }}>1's (Exp. PPS: 0.25)</th>
                        <th colSpan="2" style={{ border: '1px solid #ddd' }}>0's (Exp. PPS: 0.00)</th>
                      </tr>
                      <tr style={{ backgroundColor: '#ecf0f1', color: '#2c3e50' }}>
                        <th style={{ border: '1px solid #ddd', fontWeight: 'bold' }}>Side</th>
                        {[...Array(6)].map((_, i) => (
                          <React.Fragment key={i}>
                            <th style={{ border: '1px solid #ddd' }}>% of Shots</th>
                            <th style={{ border: '1px solid #ddd' }}>Actual PPS</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>Offense</td>
                        {selectedTeamStats.shotDistribution.offense.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <td style={{ border: '1px solid #ddd' }}>{item.pct}</td>
                            <td style={{ border: '1px solid #ddd', fontWeight: '500' }}>{item.pps}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>Defense</td>
                        {selectedTeamStats.shotDistribution.defense.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <td style={{ border: '1px solid #ddd' }}>{item.pct}</td>
                            <td style={{ border: '1px solid #ddd', fontWeight: '500' }}>{item.pps}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* NEW: Comprehensive Game-by-Game Performance Log Table */}
                <div style={{ marginTop: '40px', width: '100%', overflowX: 'auto' }}>
                  <h3 style={{ marginBottom: '15px' }}>Schedule</h3>
                  <table className="play-table" style={{ fontSize: '0.74rem', width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th colSpan="6" style={{ border: '1px solid #ddd', padding: '6px', fontSize: '0.9rem' }}>Game Summary</th>
                        <th colSpan="8" style={{ backgroundColor: '#16a085', border: '1px solid #ddd', padding: '6px', fontSize: '0.9rem' }}>Offensive Breakdown</th>
                        <th colSpan="8" style={{ backgroundColor: '#2980b9', border: '1px solid #ddd', padding: '6px', fontSize: '0.9rem' }}>Defensive Breakdown</th>
                      </tr>
                      <tr style={{ backgroundColor: '#ecf0f1', color: '#2c3e50', fontWeight: 'bold' }}>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px' }}>Date</th><th style={{ border: '1px solid #ddd', padding: '4px' }}>Opp.</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px' }}>Game Result</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px' }}>System Result</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px' }}>Shot Margin</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px' }}>Poss.</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>SQ Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>RQ Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>6% Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>4% Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>3% Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>1% Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>7/11% Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#e8f8f5' }}>0% Off</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>SQ Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>RQ Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>6% Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>4% Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>3% Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>1% Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>7/11% Def</th>
                        <th style={{ border: '1px solid #ddd', padding: '3.5px', backgroundColor: '#eaf2f8' }}>0% Def</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeamStats.schedule && selectedTeamStats.schedule.map((game, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td style={{ border: '1px solid #ddd', padding: '4px' }}>{game.date}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: '500', textAlign: 'left' }}>{game.opponent}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold', color: game.gameResult.startsWith('W') ? 'green' : 'red' }}>{game.gameResult}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', color: game.systemResult.startsWith('W') ? 'green' : 'red' }}>{game.systemResult}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: '500', color: game.shotMargin.startsWith('+') ? 'green' : 'inherit' }}>{game.shotMargin}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px' }}>{game.possSummary}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9', fontWeight: '500' }}>{game.sqOff}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9' }}>{game.rqOff}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9' }}>{game.off6}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9' }}>{game.off4}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9' }}>{game.off3}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9' }}>{game.off1}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9', fontSize: '0.5rem' }}>{game.off7_11}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f4fbf9', color: '#c0392b' }}>{game.off0}</td>
                          <td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc', fontWeight: '500' }}>{game.sqDef}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc' }}>{game.rqDef}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc' }}>{game.def6}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc' }}>{game.def4}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc' }}>{game.def3}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc' }}>{game.def1}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc', fontSize: '0.5rem' }}>{game.def7_11}</td><td style={{ border: '1px solid #ddd', padding: '4px', backgroundColor: '#f5f9fc', color: '#c0392b' }}>{game.def0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
        {/* ========================================================= */}
        {/* LEAGUE LEADERBOARDS TAB                                   */}
        {/* ========================================================= */}
        {activeTab === 'League' && (
          <section style={{ animation: 'fadeIn 0.4s ease-in-out' }}>
            <div style={{ textAlign: 'left', marginBottom: '25px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>League Statistical Leaderboards</h2>
              <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                Compare analytical performance matrices, execution efficiency rates, and possession shot breakdowns across all conference teams.
              </p>
            </div>

            {leagueLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', fontStyle: 'italic', color: '#888' }}>
                Processing data statistics across database files...
              </div>
            ) : (
              <div>
                {/* 1. OFFENSIVE SUMMARY LEADERBOARD */}
                <h3 style={{ textAlign: 'left', color: '#2c3e50', margin: '20px 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏀 Team Offensive Performance Summary
                </h3>
                <SortableLeagueTable 
                  data={leagueSummary}
                  initialSortKey="offense.result_q"
                  columns={[
                    { key: 'teamName', label: 'Team Name', sortable: true },
                    { key: 'record', label: 'Record', sortable: true },
                    { key: 'systemRecord', label: 'System Record', sortable: true },
                    { key: 'offense.sysG', label: 'System Score', decimals: 2 },
                    { key: 'offense.shotMargin', label: 'Shot Margin', sortable: true },
                    { key: 'offense.possG', label: 'Possessions', decimals: 1 },
                    { key: 'offense.shotsGained', label: 'Shots Gained/100', decimals: 1 },
                    { key: 'offense.result_q', label: 'Result Quality', decimals: 3 },
                    { key: 'offense.shot_q', label: 'Shot Quality', decimals: 3 },
                    { key: 'offense.stint_q', label: 'Stint Quality', decimals: 3 },
                    { key: 'offense.oRebPct', label: 'OREB%', sortable: true },
                    { key: 'offense.ftRebG', label: 'FT REB', decimals: 2 }
                  ]}
                />

                {/* 2. DEFENSIVE SUMMARY LEADERBOARD */}
                <h3 style={{ textAlign: 'left', color: '#c0392b', margin: '30px 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🛡️ Team Defensive Performance Summary
                </h3>
                <SortableLeagueTable 
                  data={leagueSummary}
                  initialSortKey="defense.result_q"
                  columns={[
                    { key: 'teamName', label: 'Team Name', sortable: true },
                    { key: 'record', label: 'Record', sortable: true },
                    { key: 'systemRecord', label: 'System Record', sortable: true },
                    { key: 'defense.sysG', label: 'System Score', decimals: 2 },
                    { key: 'defense.shotMargin', label: 'Shot Margin', sortable: true },
                    { key: 'defense.possG', label: 'Possessions', decimals: 1 },
                    { key: 'defense.shotsGained', label: 'Shots Gained/100', decimals: 1 },
                    { key: 'defense.result_q', label: 'Result Quality', decimals: 3 },
                    { key: 'defense.shot_q', label: 'Shot Quality', decimals: 3 },
                    { key: 'defense.stint_q', label: 'Stint Quality', decimals: 3 },
                    { key: 'defense.oRebPct', label: 'OREB%', sortable: true },
                    { key: 'defense.ftRebG', label: 'FT REB', decimals: 2 }
                  ]}
                />

                {/* 3. SHOT BREAKDOWN OFFENSE LEADERBOARD */}
                <h3 style={{ textAlign: 'left', color: '#2c3e50', margin: '30px 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📊 Shot Distribution & Execution Breakdown (Offense)
                </h3>
                <SortableLeagueTable 
                  data={leagueSummary}
                  initialSortKey="teamName"
                  columns={[
                    { key: 'teamName', label: 'Team Name', sortable: true },
                    { key: 'offense.distribution.0.pct', label: "% of Shots (6's)" },
                    { key: 'offense.distribution.0.pps', label: "Actual PPS (6's)" },
                    { key: 'offense.distribution.1.pct', label: "% of Shots (4's)" },
                    { key: 'offense.distribution.1.pps', label: "Actual PPS (4's)" },
                    { key: 'offense.distribution.2.pct', label: "% of Shots (7's)" },
                    { key: 'offense.distribution.2.pps', label: "Actual PPS (7's)" },
                    { key: 'offense.distribution.3.pct', label: "% of Shots (3's)" },
                    { key: 'offense.distribution.3.pps', label: "Actual PPS (3's)" },
                    { key: 'offense.distribution.4.pct', label: "% of Shots (1's)" },
                    { key: 'offense.distribution.4.pps', label: "Actual PPS (1's)" },
                    { key: 'offense.distribution.5.pct', label: "% of Shots (0's)" },
                    { key: 'offense.distribution.5.pps', label: "Actual PPS (0's)" }
                  ]}
                />

                {/* 4. SHOT BREAKDOWN DEFENSE LEADERBOARD */}
                <h3 style={{ textAlign: 'left', color: '#c0392b', margin: '30px 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎯 Shot Distribution & Execution Breakdown (Defense)
                </h3>
                <SortableLeagueTable 
                  data={leagueSummary}
                  initialSortKey="teamName"
                  columns={[
                    { key: 'teamName', label: 'Team Name', sortable: true },
                    { key: 'defense.distribution.0.pct', label: "% of Shots (6's)" },
                    { key: 'defense.distribution.0.pps', label: "Actual PPS (6's)" },
                    { key: 'defense.distribution.1.pct', label: "% of Shots (4's)" },
                    { key: 'defense.distribution.1.pps', label: "Actual PPS (4's)" },
                    { key: 'defense.distribution.2.pct', label: "% of Shots (7's)" },
                    { key: 'defense.distribution.2.pps', label: "Actual PPS (7's)" },
                    { key: 'defense.distribution.3.pct', label: "% of Shots (3's)" },
                    { key: 'defense.distribution.3.pps', label: "Actual PPS (3's)" },
                    { key: 'defense.distribution.4.pct', label: "% of Shots (1's)" },
                    { key: 'defense.distribution.4.pps', label: "Actual PPS (1's)" },
                    { key: 'defense.distribution.5.pct', label: "% of Shots (0's)" },
                    { key: 'defense.distribution.5.pps', label: "Actual PPS (0's)" }
                  ]}
                />
              </div>
            )}
          </section>
        )}
        {activeTab === 'System' && systemStats && (
          <section style={{ textAlign: 'center', marginTop: '40px' }}>
            <h1 style={{ marginBottom: '30px' }}>Scoring System Results</h1>
            
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0' }}>
                  Scoring System Accuracy: {systemStats.standard.pct}% ({systemStats.standard.count}/{systemStats.total})
                </p>
                <p style={{ fontSize: '1.2rem', margin: '5px 0 0 0', color: '#666' }}>
                  Projected Record: {systemStats.standard.count}-{systemStats.total - systemStats.standard.count}
                </p>
              </div>
              

              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: '600', margin: '0' }}>
                  Conservative Accuracy: {systemStats.conservative.pct}% ({systemStats.conservative.count}/{systemStats.total})
                </p>
                <p style={{ fontSize: '1.0rem', margin: '2px 0 0 0', color: '#666' }}>
                  Projected Record: {systemStats.conservative.count}-{systemStats.total - systemStats.conservative.count}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: '600', margin: '0' }}>
                  Aggressive Accuracy: {systemStats.aggressive.pct}% ({systemStats.aggressive.count}/{systemStats.total})
                </p>
                <p style={{ fontSize: '1.0rem', margin: '2px 0 0 0', color: '#666' }}>
                  Projected Record: {systemStats.aggressive.count}-{systemStats.total - systemStats.aggressive.count}
                </p>
              </div>
            </div>

            <div  style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '50px', margin: '20px auto' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Scoring Environment</h2>
              
              <table className="play-table" style = {{width: 'auto', margin: '0 auto', tableLayout: 'fixed'}}>
                <thead>
                  <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    <th style ={{width: '75px'}}>Shot Type</th>
                    <th style ={{width: '75px'}}>Actual PPS</th>
                    <th style ={{width: '75px'}}>Expected PPS</th>
                    <th style ={{width: '75px'}}>PPS Difference</th>
                    <th style ={{width: '75px'}}>Shot Variation</th>
                  </tr>
                </thead>
                <tbody>
                  {systemStats.shotTable.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold' }}>{row.type}</td>
                      <td>{row.actual}</td>
                      <td>{row.expected}</td>
                      <td style={{ color: parseFloat(row.diff) >= 0 ? 'green' : 'red' }}>
                        {parseFloat(row.diff) > 0 ? `+${row.diff}` : row.diff}
                      </td>
                      <td>{row.rsd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '50px', width: '98%', margin: '50px auto' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Team Performance vs. System</h2>
              <table className="play-table" style = {{width: 'auto', margin: '0 auto', tableLayout: 'fixed'}}>
                <thead>
                  <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                    <th>Team</th>
                    <th>Record</th>
                    <th>System Record</th>
                    <th>GB</th>
                    <th>Matched</th>
                    <th>Mismatched</th>
                    <th>Exp. PPS</th>
                    <th>Act. PPS</th>
                    <th>PPS Diff</th>
                    <th>Exp. PPP</th>
                    <th>Act. PPP</th>
                    <th>PPP Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {systemStats.teamTable.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold', textAlign: 'left' }}>{row.name}</td>
                      <td>{row.record}</td>
                      <td>{row.sysRecord}</td>
                      <td style={{ color: row.gb > 0 ? 'green' : row.gb < 0 ? 'red' : 'inherit', fontWeight: 'bold' }}>
                        {row.gb > 0 ? `+${row.gb}` : row.gb}
                      </td>
                      <td>{row.matched}</td>
                      <td>{row.mismatched}</td>
                      <td>{row.expectedPPS}</td>
                      <td>{row.actualPPS}</td>
                      <td style={{ color: parseFloat(row.ppsDiff) >= 0 ? 'green' : 'red' }}>
                        {parseFloat(row.ppsDiff) > 0 ? `+${row.ppsDiff}` : row.ppsDiff}
                      </td>
                      <td>{row.expectedPPP}</td>
                      <td>{row.actualPPP}</td>
                      <td style={{ color: parseFloat(row.pppDiff) >= 0 ? 'green' : 'red' }}>
                        {parseFloat(row.pppDiff) > 0 ? `+${row.pppDiff}` : row.pppDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* NEW INTERACTIVE CHART ELEMENT PLACED STRATEGICALLY UNDER TITLE */}
            {systemStats && systemStats.rawDifferentials && (
              <SystemDifferentialChart rawData={systemStats.rawDifferentials} />
            )}
            {/* --- SURGICAL ADDITION: PDF DOWNLOAD LINKS --- */}
            <hr style={{ margin: '20px auto 20px auto', width: '90%', border: '0', borderTop: '1px solid #ddd' }} />
            <p style={{ margin: 20, fontSize: '1.7rem', color: '#666' }}>Behind the dashboard is a complete analytical framework — explore the full research, methodology, and findings below.</p>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '20px', 
              marginBottom: '40px' 
            }}>
              <a 
                href="/manuals/MEC_Shot_Quality_Study.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#16a085',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}
              >
                📄 System Scoring Study Write-Up (PDF)
              </a>
              <a 
                href="/manuals/Shot_Quality_Scoring_System_Presentation.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2980b9',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}
              >
                📄 System Scoring Study Presentation (PDF)
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;