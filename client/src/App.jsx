import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import { 
  ResponsiveContainer, 
  BarChart,
  ComposedChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  LineChart, 
  Line, 
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

const getApiBaseUrl = () => {
  const host = window.location.hostname;
  const port = window.location.port;

  if (host === 'localhost' || host === '127.0.0.1') {
    return port === '5173' ? 'http://localhost:5000' : '';
  }
  return '';
};

axios.defaults.withCredentials = true;
const API_BASE_URL = getApiBaseUrl();

// ==========================================
// SUB-COMPONENT: SYSTEM DIFFERENTIAL CHART (SYSTEM TAB)
// ==========================================
function SystemDifferentialChart({ rawData }) {
  const [binSize, setBinSize] = useState(10);

  const binnedData = useMemo(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];
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
        "System Accuracy": b.totalCount > 0 ? Math.round((b.correctCount / b.totalCount) * 100) : 0,
        "Game Count": b.totalCount
      }))
      .filter(b => b["Game Count"] > 0);
  }, [rawData, binSize]);

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', maxWidth: '800px', margin: '20px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ margin: 0 }}>Game Prediction Accuracy by System Score Differential</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>How predictive is the system as the System Score gap increases?</p>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginRight: '5px' }}>BIN SIZE: </label>
          <select value={binSize} onChange={(e) => setBinSize(Number(e.target.value))} style={{ padding: '4px', borderRadius: '4px' }}>
            {[5, 10, 15, 20, 25].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>

      <div style={{ height: '350px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={binnedData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="range"
              stroke="#718096"
              fontSize={12}
              tickLine={false}
              angle={-90}
              textAnchor="end"
              interval={0}
            />
            <YAxis stroke="#718096" fontSize={12} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              cursor={{ fill: '#EDF2F7', opacity: 0.4 }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '10px', fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#2c3e50' }}>Differential: {label}</p>
                      <p style={{ margin: '0 0 3px 0', color: '#2980b9' }}>Accuracy: {payload[0].value}%</p>
                      <p style={{ margin: 0, color: '#666' }}>Games: {payload[0].payload["Game Count"]}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            <Bar dataKey="System Accuracy" fill='#2980b9' radius={[4, 4, 0, 0]} barSize={45}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// ==========================================
// UPDATED SUB-COMPONENT: SECTION 3: PERFORMANCE BY PERIOD
// ==========================================
const PerformanceByPeriod = ({ periodStats, homeName = "Home", awayName = "Away", activeMetricLabel = "Value" }) => {
  if (!periodStats || periodStats.length === 0) {
    return (
      <div className="coach-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '335px' }}>
        <p style={{ color: '#7f8c8d' }}>No period stats computed for this game.</p>
      </div>
    );
  }

  // Dynamically find the property keys inside the object that aren't the title string
  const sampleKeys = Object.keys(periodStats[0] || {}).filter(k => k !== 'period');
  const homeKey = sampleKeys[0] || 'Home';
  const awayKey = sampleKeys[1] || 'Away';

  const { homeColor, awayColor } = getChartColors(homeName, awayName);

  return (
    <div className="coach-card" style={{ flex: 1 }}>
      <h3 className="section-title">{activeMetricLabel} by Period</h3>
      <div style={{ width: '100%', height: '280px', marginTop: '15px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={periodStats} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="period" stroke="#7f8c8d" />
            <YAxis stroke="#7f8c8d" />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend verticalAlign="top" height={36} />
            <Bar dataKey={homeKey} name={homeName} fill={homeColor} radius={[4, 4, 0, 0]} />
            <Bar dataKey={awayKey} name={awayName} fill={awayColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ==========================================
// UPDATED SUB-COMPONENT: SECTION 4: POSSESSION STINT TIMELINE
// ==========================================
const PossessionStintTimeline = ({ timelineData, homeName = "Home", awayName = "Away", activeMetricLabel = "Value" }) => {
  if (!timelineData || !Array.isArray(timelineData) || timelineData.length === 0) {
    return (
      <div className="coach-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '335px' }}>
        <p style={{ color: '#7f8c8d' }}>No stretch timeline tracking details found.</p>
      </div>
    );
  }

  // Safely find the metric evaluation keys being outputted by your useMemo hook
  const sampleKeys = Object.keys(timelineData[0] || {}).filter(k => k !== 'bin');
  const homeKey = sampleKeys[0] || 'Home';
  const awayKey = sampleKeys[1] || 'Away';

  const { homeColor, awayColor } = getChartColors(homeName, awayName);

  return (
    <div className="coach-card" style={{ flex: 1 }}>
      <h3 className="section-title">{activeMetricLabel} by Poss. Intervals</h3>
      <div style={{ width: '100%', height: '280px', marginTop: '15px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timelineData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="bin" stroke="#7f8c8d" interval={0}  style={{ fontSize: '0.6rem' }} />
            <YAxis stroke="#7f8c8d" fontSize={11} tickLine={false} />
            <Tooltip />
            <Legend verticalAlign="top" height={36} />
            <ReferenceLine y={0} stroke="#e74c3c" strokeDasharray="5 5" />
            <Line 
              type="monotone" 
              dataKey={homeKey} 
              name={homeName} 
              stroke={homeColor} 
              strokeWidth={3} 
              dot={{ r: 4 }} 
              activeDot={{ r: 7 }} 
            />
            <Line 
              type="monotone" 
              dataKey={awayKey} 
              name={awayName} 
              stroke={awayColor} 
              strokeWidth={3} 
              dot={{ r: 4 }} 
              activeDot={{ r: 7 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: SORTABLE LEAGUE TABLE (LEAGUE TAB)
// ==========================================
function SortableLeagueTable({ data, columns, initialSortKey }) {
  const [sortConfig, setSortConfig] = useState({ key: initialSortKey, direction: 'desc' });

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const getNestedValue = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
        let aVal = getNestedValue(a, sortConfig.key);
        let bVal = getNestedValue(b, sortConfig.key);

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
                  minWidth: col.minWidth || 'auto',
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
                  <td key={col.key} style={{ padding: '8px', minWidth: col.minWidth || 'auto', fontSize: '0.85rem', borderBottom: '1px solid #e0e0e0' }}>
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

// ==========================================
// NEW SUB-COMPONENT: SECTION 1: EXECUTIVE MATCHUP SIDE-BY-SIDE
// ==========================================
const ExecutiveMatchup = ({ gameData, winProbability = 50 }) => {
  if (!gameData) return null;

  const {
    Home: {
      name: homeTeam = "Home Team", score: homeScore = 0, system: homeSystemScore = 0, poss: homePoss = 1, shots: homeShots = 1, sQual: homeSQual = 0
    } = {},
    Away: {
      name: awayTeam = "Away Team", score: awayScore = 0, system: awaySystemScore = 0, poss: awayPoss = 1, shots: awayShots = 1, sQual: awaySQual = 0
    } = {}
  } = gameData;

  const homePPP = (homeScore / (homePoss || 1)).toFixed(2);
  const awayPPP = (awayScore / (awayPoss || 1)).toFixed(2);
  const homeRQ = (homeSystemScore / (homePoss || 1)).toFixed(2);
  const awayRQ = (awaySystemScore / (awayPoss || 1)).toFixed(2);
  const homeSQ = (homeSQual / (homeShots || 1)).toFixed(2);
  const awaySQ = (awaySQual / (awayShots || 1)).toFixed(2);
  const homeShotMargin = homeShots - awayShots;
  const awayShotMargin = awayShots - homeShots;

  // Paths pointing directly to your public assets folder
  const homeLogoSrc = `/MEC Logos/${homeTeam}.png`;
  const awayLogoSrc = `/MEC Logos/${awayTeam}.png`;

  console.log("LOG PATH ENGINES:", { homeLogoSrc, awayLogoSrc });
  // Fallback function if a specific team logo PNG file is missing or misspelled
  const handleImageError = (e) => {
    e.target.style.display = 'none'; // Hides the broken image link smoothly
  };

  // --- TEAM COLOR ACCENTS ---
  // Pull each team's brand primary color from TEAM_COLORS. If a team's
  // primary is near-white (unreadable on a white card), fall back to
  // their secondary color instead. Unknown teams fall back to the
  // existing default teal/blue.
  const pickAccent = (teamName, fallback) => {
    const c = TEAM_COLORS[teamName];
    if (!c) return fallback;
    return getLuminance(c.primary) > 0.9 ? (c.secondary || fallback) : c.primary;
  };
  const homeAccent = pickAccent(homeTeam, DEFAULT_HOME_COLOR);
  const awayAccent = pickAccent(awayTeam, DEFAULT_AWAY_COLOR);

  return (
    <div
      className="coach-card executive-matchup-grid team-accent-card"
      style={{ marginBottom: '25px', '--home-accent': homeAccent, '--away-accent': awayAccent }}
    >
      {/* LEFT COLUMN: HOME TEAM */}
      <div className="team-column" style={{ background: `linear-gradient(180deg, ${homeAccent}14, transparent 60%)` }}>
        <div className="team-logo-container" style={{ background: `radial-gradient(circle, ${homeAccent}33 0%, transparent 72%)` }}>
          <img 
            src={homeLogoSrc} 
            alt={`${homeTeam} Logo`} 
            className="dashboard-team-logo"
            onError={handleImageError}
          />
        </div>
        <h2 className="team-name" style={{ color: homeAccent }}>{homeTeam}</h2>
        <div className="metric-value massive-text" style={{ color: homeAccent }}>{homeScore} <span className="small-subtext">({homePPP} PPP)</span></div>
        <div className="metric-value massive-text" style={{ color: homeAccent }}>{homeSystemScore} <span className="small-subtext">({homeRQ} RQ)</span></div>
        <div className="metric-value normal-text font-bold" style={{ color: homeAccent }}>{homePoss}</div>
        <div className="metric-gap"></div>
        <div className="metric-value normal-text font-bold" style={{ color: homeAccent }}>{homeSQ}</div>
        <div className="metric-value normal-text font-bold" style={{ color: homeAccent }}>{homeShotMargin > 0 ? `+${homeShotMargin}` : homeShotMargin}</div>
        <div className="metric-value large-text win-prob-cell">
          <div className="win-prob-track">
            <div className="win-prob-fill" style={{ width: `${winProbability}%`, background: homeAccent }} />
          </div>
          <span style={{ color: homeAccent, fontWeight: 800 }}>{winProbability}%</span>
        </div>
      </div>

      {/* CENTER COLUMN: LABELS */}
      <div className="labels-column">
        <div className="team-logo-container" style={{ visibility: 'hidden' }}></div>
        <div className="label-text team-label-title" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px' }}>VS</div>
        <div className="label-text">Actual Score</div>
        <div className="label-text">System Score</div>
        <div className="label-text">Possessions</div>
        <div className="label-space-divider"></div>
        <div className="label-text">Shot Quality</div>
        <div className="label-text">Shot Margin</div>
        <div className="label-text">Win Probability</div>
      </div>

      {/* RIGHT COLUMN: AWAY TEAM */}
      <div className="team-column" style={{ background: `linear-gradient(180deg, ${awayAccent}14, transparent 60%)` }}>
        <div className="team-logo-container" style={{ background: `radial-gradient(circle, ${awayAccent}33 0%, transparent 72%)` }}>
          <img 
            src={awayLogoSrc} 
            alt={`${awayTeam} Logo`} 
            className="dashboard-team-logo"
            onError={handleImageError}
          />
        </div>
        <h2 className="team-name font-bold" style={{ color: awayAccent }}>{awayTeam}</h2>
        <div className="metric-value massive-text" style={{ color: awayAccent }}>{awayScore} <span className="small-subtext">({awayPPP} PPP)</span></div>
        <div className="metric-value massive-text" style={{ color: awayAccent }}>{awaySystemScore} <span className="small-subtext">({awayRQ} RQ)</span></div>
        <div className="metric-value normal-text font-bold" style={{ color: awayAccent }}>{awayPoss}</div>
        <div className="metric-gap"></div>
        <div className="metric-value normal-text font-bold" style={{ color: awayAccent }}>{awaySQ}</div>
        <div className="metric-value normal-text font-bold" style={{ color: awayAccent }}>{awayShotMargin > 0 ? `+${awayShotMargin}` : awayShotMargin}</div>
        <div className="metric-value large-text win-prob-cell">
          <div className="win-prob-track">
            <div className="win-prob-fill" style={{ width: `${100 - winProbability}%`, background: awayAccent }} />
          </div>
          <span style={{ color: awayAccent, fontWeight: 800 }}>{(100 - winProbability)}%</span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// NEW SUB-COMPONENT: SECTIONS 2 & 3: SHOT DISTRIBUTION & EXECUTION
// ==========================================
function ShotDistributionAndExecution({ gameSummary }) {
  if (!gameSummary) return null;

  const home = gameSummary.Home;
  const away = gameSummary.Away;

  const { homeColor, awayColor } = getChartColors(home.name, away.name);

  console.log("PIE DATA PAYLOAD DIAGNOSTIC:", { homeBreakdown: home?.breakdown, awayBreakdown: away?.breakdown });
  // Section 2: Doughnut / Pie Chart Data Transformation
  // Helper utility to safely convert percentages like '40.5%' into numbers like 40.5
  const parsePercent = (val) => {
    if (!val) return 0;
    // If it contains a slash (like s7_11: '12.9% / 0.0%'), isolate the first value (System 7s)
    const baseVal = val.toString().split('/')[0];
    const parsed = parseFloat(baseVal.replace('%', ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateExpected7_11 = (breakdown) => {
      if (!breakdown || !breakdown.s7_11) return 1.75;
      const parts = breakdown.s7_11.toString().split('/');
      const p7 = parseFloat(parts[0]?.replace('%', '')) || 0;
      const p11 = parseFloat(parts[1]?.replace('%', '')) || 0;
      if (p7 + p11 === 0) return 1.75;
      // Formula: (7*7s + 11*11s) / (4 * (7s + 11s))
      return (7 * p7 + 11 * p11) / (4 * (p7 + p11));
  };

  const homeExpected7_11 = calculateExpected7_11(home.breakdown);
  const awayExpected7_11 = calculateExpected7_11(away.breakdown);

  const homePieData = [
    { name: "6's", value: parsePercent(home.breakdown?.s6), color: '#32CD32'},
    { name: "4's", value: parsePercent(home.breakdown?.s4), color: '#2980b9' },
    { name: "7's/11's", value: parsePercent(home.breakdown?.s7_11), color: '#2c3e50'  },
    { name: "3's", value: parsePercent(home.breakdown?.s3), color: '#e67e22' },
    { name: "1's", value: parsePercent(home.breakdown?.s1), color: '#FF0000' },
    { name: "0's", value: parsePercent(home.breakdown?.s0), color: '#000000' }
  ].filter(d => d.value > 0);
  
  const awayPieData = [
    { name: "6's", value: parsePercent(away.breakdown?.s6), color: '#32CD32' },
    { name: "4's", value: parsePercent(away.breakdown?.s4), color:  '#2980b9'},
    { name: "7's/11's", value: parsePercent(away.breakdown?.s7_11), color: '#2c3e50' },
    { name: "3's", value: parsePercent(away.breakdown?.s3), color: '#e67e22' },
    { name: "1's", value: parsePercent(away.breakdown?.s1), color: '#FF0000' },
    { name: "0's", value: parsePercent(away.breakdown?.s0), color: '#000000' }
  ].filter(d => d.value > 0);

  // Section 3: Horizontal Grouped Bar Charts for Execution vs Expected Benchmark
  const executionData = [
    { name: "6's", expected: 1.50, homeAct: (parseFloat(home.execution.e6) || 0).toFixed(2), awayAct: (parseFloat(away.execution.e6) || 0).toFixed(2) },
    { name: "4's", expected: 1.00, homeAct: (parseFloat(home.execution.e4) || 0).toFixed(2), awayAct: (parseFloat(away.execution.e4) || 0).toFixed(2) },
    { name: "7/11's", expectedHome: parseFloat(homeExpected7_11.toFixed(2)), expectedAway: parseFloat(awayExpected7_11.toFixed(2)), homeAct: (parseFloat(home.execution.e7_11) || 0).toFixed(2), awayAct: (parseFloat(away.execution.e7_11) || 0).toFixed(2) },
    { name: "3's", expected: 0.75, homeAct: (parseFloat(home.execution.e3) || 0).toFixed(2), awayAct: (parseFloat(away.execution.e3) || 0).toFixed(2) },
    { name: "1's", expected: 0.25, homeAct: (parseFloat(home.execution.e1) || 0).toFixed(2), awayAct: (parseFloat(away.execution.e1) || 0).toFixed(2) },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'window.innerWidth > 900 ? "1fr 1fr" : "1fr"', gap: '20px', marginBottom: '25px' }}>
      
      {/* SECTION 2: SIDE-BY-SIDE SHOT DISTRIBUTION DOUGHNUTS */}
      <div className="coach-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 5px 0', textAlign: 'left' }}>Shot Type Distribution</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#666', textAlign: 'left' }}>Visual comparison of total shot frequencies per team.</p>
        
        {/* REPLACED: Updated dynamic layout section to securely anchor the Recharts Pie elements */}
        {/* UPDATED: High-clearance grid layout for maximum horizontal text room */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '30px', 
          width: '100%',
          margin: '20px auto',
          alignItems: 'center',
          justifyItems: 'center'
        }}>
          
          {/* HOME PIE CHART WRAPPER BLOCK */}
          <div style={{ 
            width: '100%', 
            maxWidth: '350px', 
            height: '260px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            backgroundColor: '#f8f9fa', /* Light subtle background to frame the chart zone */
            padding: '15px',
            borderRadius: '8px'
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '10px', color: '#2c3e50' }}>{home.name}</span>
            <div style={{ width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                {/* Generous 40px side margins so long strings never touch the boundaries */}
                <PieChart margin={{ top: 10, right: 40, left: 40, bottom: 10 }}>
                  <Pie 
                    data={homePieData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={30} 
                    outerRadius={65} 
                    paddingAngle={2}
                    label={({ name, value }) => `${value}%`}
                    labelLine={{ stroke: '#7f8c8d', strokeWidth: 1.5 }}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out"
                  >
                    {homePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Volume Distribution']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AWAY PIE CHART WRAPPER BLOCK */}
          <div style={{ 
            width: '100%', 
            maxWidth: '350px', 
            height: '260px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px'
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '10px', color: '#2c3e50' }}>{away.name}</span>
            <div style={{ width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 40, left: 40, bottom: 10 }}>
                  <Pie 
                    data={awayPieData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={30} 
                    outerRadius={65} 
                    paddingAngle={2}
                    label={({ name, value }) => `${value}%`}
                    labelLine={{ stroke: '#7f8c8d', strokeWidth: 1.5 }}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out"
                  >
                    {awayPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Volume Distribution']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.75rem', marginTop: '5px' }}>
          {[['6\'s', '#32CD32'], ['4\'s', '#2980b9'], ['7/11\'s', '#2c3e50'], ['3\'s', '#e67e22'], ['1\'s', '#FF0000'], ['0\'s', '#000000']].map(tag => (
            <span key={tag[0]} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><b style={{ color: tag[1] }}>■</b> {tag[0]}</span>
          ))}
        </div>
      </div>

      {/* SECTION 3: CLUSTERED HORIZONTAL EXECUTION VS EXPECTED PPS */}
      <div className="coach-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 5px 0', textAlign: 'left' }}>Points Per Shot Execution</h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: '#666', textAlign: 'left' }}>Actual execution rates compared against expected Shot Quality baselines.</p>
        
        <div style={{ height: '230px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={executionData} layout="vertical" margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" domain={[0, 2.5]} ticks = {[0.0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5]} tickFormatter={(value) => value.toFixed(2)} stroke="#718096" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="#718096" fontSize={11} tickLine={false} />
              <Tooltip formatter={(value) => [`${value} PPS`, 'Execution']} />
              <Legend wrapperStyle={{ fontSize: '15px' }} />
              <Bar dataKey="homeAct" name={`${home.name} PPS`} fill={homeColor} radius={[0, 3, 3, 0]} barSize={40} />
              <Bar dataKey="awayAct" name={`${away.name} PPS`} fill={awayColor} radius={[0, 3, 3, 0]} barSize={40} />

              {/* Vertical Baseline Markers linking each category locale across the top */}
              {/*<Line type="monotone" dataKey="expectedHome" name={`${home.name} Benchmark`} stroke="#16a085" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} activeDot={{ r: 6 }} /> */}
              {/*<Line type="monotone" dataKey="expectedAway" name={`${away.name} Benchmark`} stroke="#e67e22" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} activeDot={{ r: 6 }} />*/}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

const getMetricLabel = (metricKey) => {
  const mapping = {
    systemScore: 'System Score',
    shotQuality: 'Shot Quality',
    shotMargin: 'Shot Margin',
    possVolume: 'Possession',
    actualPoints: 'Actual Points scored'
  };
  return mapping[metricKey] || 'Metrics';
};

const TEAM_COLORS = {
  "West Liberty": {"primary": "#FFCD32", "secondary": "#000000"},
  "Fairmont": {"primary": "#6F313C", "secondary": "#FFFFFF"},
  "Wheeling": {"primary": "#E71636", "secondary": "#FCBF17"},
  "Charleston": {"primary": "#992244", "secondary": "#FFD200"},
  "Concord": {"primary": "#74033B", "secondary": "#86949F"},
  "Glenville": {"primary": "#0051BA", "secondary": "#FFFFFF"},
  "Frostburg": {"primary": "#E91F2d", "secondary": "#000000"},
  "D&E": {"primary": "#D21C2E", "secondary": "#FFFFFF"},
  "Point Park": {"primary": "#6D8D24", "secondary": "#FDB813"},
  "WVSU": {"primary": "#CFAB2B", "secondary": "#000000"},
  "Salem": {"primary": "#149348", "secondary": "#FFFFFF"},
  "Wesleyan": {"primary": "#FF4C00", "secondary": "#000000"}
};
const DEFAULT_HOME_COLOR = "#16a085";
const DEFAULT_AWAY_COLOR = "#2980b9";

// ==========================================
// TEAM TAB "FRAME" COLORS
// Frame background = team's primary color as-is.
// Card border = team's secondary color as-is.
// ==========================================
const getTeamFrameColors = (teamName) => {
  const colors = TEAM_COLORS[teamName];
  if (!colors) return { frame: '#2c3e50', accent: '#16a085' };
  return { frame: colors.primary, accent: colors.secondary };
};

export const getChartColors = (homeName, awayName) => {
  const homeColors = TEAM_COLORS[homeName] || { primary: DEFAULT_HOME_COLOR, secondary: "#ffffff" };
  const awayColors = TEAM_COLORS[awayName] || { primary: DEFAULT_AWAY_COLOR, secondary: "#ffffff" };

  let homeChartColor = homeColors.primary;
  let awayChartColor = awayColors.primary;

  // Resolve matching color conflicts
  if (homeChartColor.toLowerCase() === awayChartColor.toLowerCase()) {
    // Fallback to Away team's secondary color if it isn't white or transparent
    if (awayColors.secondary && !["#ffffff", "#fff", "#000000"].includes(awayColors.secondary.toLowerCase())) {
      awayChartColor = awayColors.secondary;
    } else {
      // Hard fallback if primary and secondary conflict (e.g., Gray/Neutral contrast)
      awayChartColor = "#e74c3c"; 
    }
  }

  return { homeColor: homeChartColor, awayColor: awayChartColor };
};

// ==========================================
// SUB-COMPONENT: TEAM PERFORMANCE VS SYSTEM SCATTERPLOT
// ==========================================

  // Custom Data Point Component: Renders the team logo inside an SVG image boundary
const CustomLogoNode = (props) => {
  const { cx, cy, payload, onShowTooltip, onHideTooltip } = props;
  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;

  const logoSrc = `/MEC Logos/${payload.teamName}.png`;
  const size = 32;

  return (
    <g transform={`translate(${cx - size / 2}, ${cy - size / 2})`}>
      <image
        href={logoSrc}
        width={size}
        height={size}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      {/* Rect on top captures mouse events reliably */}
      <rect
        x={0}
        y={0}
        width={size}
        height={size}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => {
          const rect = e.target.getBoundingClientRect();
          onShowTooltip({
            screenX: rect.left + rect.width / 2,
            screenY: rect.top,
            data: payload
          });
        }}
        onMouseLeave={onHideTooltip}
      />
    </g>
  );
};

// ==========================================
// SUB-COMPONENT: TEAM PERFORMANCE VS SYSTEM SCATTERPLOT
// ==========================================
function TeamPerformanceScatterPlot({ systemData }) {
  const [metric, setMetric] = useState('PPS'); // 'PPS' or 'PPP'
  const [hoveredTeam, setHoveredTeam] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  // Transform system performance data rows for the scatter plot
  const chartData = useMemo(() => {
    if (!systemData || !Array.isArray(systemData)) return [];
    
    return systemData.map(row => {
      // Direct exact match to your index.js backend object fields
      const expectedPPS = parseFloat(row.expectedPPS || 0);
      const actualPPS = parseFloat(row.actualPPS || 0);
      const expectedPPP = parseFloat(row.expectedPPP || 0);
      const actualPPP = parseFloat(row.actualPPP || 0);
      const teamLabel = row.name;

      return {
        teamName: teamLabel,
        x: metric === 'PPS' ? expectedPPS : expectedPPP,
        y: metric === 'PPS' ? actualPPS : actualPPP,
      };
    }).filter(d => !isNaN(d.x) && !isNaN(d.y) && d.x !== 0); // Safe boundary filter
  }, [systemData, metric]);

  // Calculate dynamic chart domains to frame points nicely
  const domains = useMemo(() => {
    if (chartData.length === 0) return { min: 0.8, max: 1.4 };
    const allVals = [...chartData.map(d => d.x), ...chartData.map(d => d.y)];
    return {
      min: Math.min(...allVals) * 0.98,
      max: Math.max(...allVals) * 1.02,
    };
  }, [chartData]); 

  {/*const RenderTransparentScatterDot = (props) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
    return <circle cx={cx} cy={cy} r={16} fill="transparent" style={{ cursor: 'pointer' }} />;
  };*/}

  const renderShape = useCallback((props) => (
    <CustomLogoNode
      {...props}
      onShowTooltip={setTooltip}
      onHideTooltip={() => setTooltip(null)}
    />
  ), []);
  return (
    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxWidth: '1000px', margin: '25px auto' }}>
      
      {/* HEADER & DROPDOWN CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.25rem', fontWeight: 'bold' }}>Team Performance vs. System Baselines</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#718096' }}>Graphing Actual Efficiency (Y-Axis) vs. Expected System Efficiency (X-Axis).</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#4a5568', textTransform: 'uppercase' }}>Metric Filter: </label>
          <select 
            value={metric} 
            onChange={(e) => setMetric(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontWeight: 'bold', color: '#2c3e50', backgroundColor: '#f8fafc', cursor: 'pointer' }}
          >
            <option value="PPS">Points Per Shot (PPS)</option>
            <option value="PPP">Points Per Possession (PPP)</option>
          </select>
        </div>
      </div>

      {/* FLOATING TOOLTIP — rendered in a portal at screen coordinates */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.screenX,
          top: tooltip.screenY - 10,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#1e293b',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '0.85rem',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
          zIndex: 9999,
        }}>
          <strong style={{ display: 'block', borderBottom: '1px solid #475569', paddingBottom: '4px', marginBottom: '6px', fontSize: '0.9rem' }}>
            {tooltip.data.teamName}
          </strong>
          <div>Expected {metric}: <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{tooltip.data.x.toFixed(2)}</span></div>
          <div>Actual {metric}: <span style={{ color: '#34d399', fontWeight: 'bold' }}>{tooltip.data.y.toFixed(2)}</span></div>
          <div style={{ marginTop: '4px', borderTop: '1px dashed #475569', paddingTop: '4px', fontSize: '0.75rem', color: '#cbd5e0' }}>
            Differential: <span style={{ fontWeight: 'bold', color: (tooltip.data.y - tooltip.data.x) >= 0 ? '#34d399' : '#f87171' }}>
              {(tooltip.data.y - tooltip.data.x) >= 0 
                ? `+${(tooltip.data.y - tooltip.data.x).toFixed(2)}` 
                : (tooltip.data.y - tooltip.data.x).toFixed(2)}
            </span>
          </div>
        </div>
      )}
      
      {/* SCATTER PLOT CHART */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ height: '480px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              
              <XAxis 
                xAxisId="x-axis"
                type="number" 
                dataKey="x" 
                name={`Expected ${metric}`} 
                domain={[domains.min, domains.max]}
                tickFormatter={(v) => v.toFixed(2)}
                stroke="#718096"
                label={{ value: `Expected ${metric} (System Model Baseline)`, position: 'insideBottom', offset: -15, fill: '#2c3e50', fontWeight: 'bold', fontSize: 13 }}
              />
              
              <YAxis 
                yAxisId="y-axis"
                type="number" 
                dataKey="y" 
                name={`Actual ${metric}`} 
                domain={[domains.min, domains.max]}
                tickFormatter={(v) => v.toFixed(2)}
                stroke="#718096"
                label={{ value: `Actual Executed ${metric}`, angle: -90, position: 'insideLeft', offset: -5, fill: '#2c3e50', fontWeight: 'bold', fontSize: 13 }}
              />

              <ZAxis range={[32, 32]} />

              {/*<Tooltip 
                cursor={{ strokeDasharray: '3 3', stroke: '#a0aec0' }}
                trigger="hover"
                shared={false}
                content={({ active, payload }) => {
                  console.log("Tooltip Core Check -> Active:", active, "Payload Length:", payload?.length);
                  if (payload && payload.length > 0) {
                    console.log("Payload Content:", payload[0].payload);
                  }
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const diff = data.y - data.x;
                    return (
                      <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
                        <strong style={{ display: 'block', borderBottom: '1px solid #475569', paddingBottom: '4px', marginBottom: '6px', fontSize: '0.9rem' }}>{data.teamName}</strong>
                        <div>Expected {metric}: <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{data.x.toFixed(2)}</span></div>
                        <div>Actual {metric}: <span style={{ color: '#34d399', fontWeight: 'bold' }}>{data.y.toFixed(2)}</span></div>
                        <div style={{ marginTop: '4px', borderTop: '1px dashed #475569', paddingTop: '4px', fontSize: '0.75rem', color: '#cbd5e0' }}>
                          Differential: <span style={{ fontWeight: 'bold', color: diff >= 0 ? '#34d399' : '#f87171' }}>{diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />*/}

              {/* Diagonal Identity Line (Y = X) */}
              <ReferenceLine 
                xAxisId="x-axis"
                yAxisId="y-axis"
                ifOverflow='extendDomain'
                segment={[{ x: Math.min(domains.min, domains.min), y: Math.min(domains.min, domains.min) }, { x: Math.max(domains.max, domains.max), y: Math.max(domains.max, domains.max) }]} 
                stroke="#ff0000" 
                strokeWidth={2}
                strokeDasharray="4 4"
              />

              <Scatter  
                name="Teams"
                xAxisId="x-axis"
                yAxisId="y-axis"
                data={chartData} 
                shape={renderShape} 
                //dataKey="y"
                //fill="#8884d8"
              />
              {/*<Scatter 
                xAxisId="x-axis"
                yAxisId="y-axis"
                name="Teams" 
                data={chartData} 
                datakey="y"
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />*/}
              {/* LAYER 2: Transparent functional node layer overlaid cleanly on top to capture hovers natively
              <Scatter data={chartData} shape={<RenderTransparentScatterDot />} /> */}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '8px',
            fontSize: '0.8rem',
            color: '#718096'
          }}>
            <svg width="40" height="8">
              <line x1="0" y1="4" x2="240" y2="4" stroke="#ff0000" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
            <span>Indicates system prediction matches actual performance for the metric for that team</span>
          </div>
      </div>
    </div>
  );
}

function TeamPerformanceCards({ teamTable }) {
  return (
    <div style={{ marginTop: '40px' }}>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '8px',
        padding: '0 8px'
      }}>
        {teamTable.map((row, idx) => {
          const total = row.matched + row.mismatched;
          const matchPct = total > 0 ? (row.matched / total) * 100 : 0;
          const ppsDiff = parseFloat(row.ppsDiff);
          const pppDiff = parseFloat(row.pppDiff);
          const gb = parseFloat(row.gb);

          return (
            <div key={idx} style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Team Name + GB Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#2c3e50' }}>{row.name}</span>
                <span style={{
                  backgroundColor: gb > 0 ? '#d1fae5' : gb < 0 ? '#fee2e2' : '#f1f5f9',
                  color: gb > 0 ? '#065f46' : gb < 0 ? '#991b1b' : '#475569',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {gb > 0 ? `+${gb}` : gb} GB
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Record</div>
                {/* Actual vs System Record */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{
                    flex: 1, textAlign: 'center', backgroundColor: '#f8fafc',
                    borderRadius: '8px', padding: '6px'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Actual</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2c3e50' }}>{row.record}</div>
                  </div>
                  <div style={{
                    flex: 1, textAlign: 'center', backgroundColor: '#f8fafc',
                    borderRadius: '8px', padding: '6px'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>System</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#64748b' }}>{row.sysRecord}</div>
                  </div>
                </div>
              </div>

              {/* Matched/Mismatched Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#64748b', marginBottom: '4px' }}>
                  <span>✅: {row.matched}</span>
                  <span>❌: {row.mismatched}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#fee2e2', overflow: 'hidden' }}>
                  <div style={{
                    width: `${matchPct}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                  {matchPct.toFixed(0)}% match rate
                </div>
              </div>

              {/* PPS / PPP Diffs */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['PPS', ppsDiff], ['PPP', pppDiff]].map(([label, diff]) => (
                  <div key={label} style={{
                    flex: 1, textAlign: 'center', borderRadius: '8px', padding: '6px',
                    backgroundColor: diff >= 0 ? '#d1fae5' : '#fee2e2'
                  }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 'bold' }}>{label} Diff</div>
                    <div style={{ fontWeight: 'bold', color: diff >= 0 ? '#065f46' : '#991b1b', fontSize: '0.9rem' }}>
                      {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamLollipopChart({ teamTable }) {
  const maxGames = Math.max(...teamTable.map(t => {
    const [w, l] = t.record.split('-').map(Number);
    return w + l;
  }));

  return (
    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxWidth: '1000px', margin: '25px auto' }}>
      
      {/* Header + Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.25rem', fontWeight: 'bold' }}>Actual vs System Win Record</h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#718096' }}>Dot = actual wins · Dashed tick = system projection · Bar = match rate</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[['#1D9E75', 'Actual wins'], ['#888780', 'System projection']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#718096' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {teamTable.map((row, idx) => {
        const [actualW] = row.record.split('-').map(Number);
        const [sysW] = row.sysRecord.split('-').map(Number);
        const total = teamTable[0].matched + teamTable[0].mismatched; // adjust if per-row
        const matchRate = Math.round((row.matched / (row.matched + row.mismatched)) * 100);
        const gb = parseFloat(row.gb);
        const actualPct = (actualW / maxGames) * 100;
        const sysPct = (sysW / maxGames) * 100;
        const gbLabel = gb === 0 ? '±0' : gb > 0 ? `+${gb}` : `${gb}`;
        const ahead = actualW >= sysW;

        return (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px', alignItems: 'center', gap: '12px', padding: '7px 0', borderBottom: idx < teamTable.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            
            {/* Team name */}
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.name}
            </div>

            {/* SVG lollipop */}
            <div style={{ position: 'relative', height: '28px' }}>
              <svg width="100%" height="28" viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden="true">
                {/* Connector line */}
                <line x1={Math.min(actualPct, sysPct) * 4} y1="11" x2={Math.max(actualPct, sysPct) * 4} y2="11"
                  stroke={ahead ? '#1D9E75' : '#E24B4A'} strokeWidth="1.5" opacity="0.35" />
                {/* System dashed tick */}
                <line x1={sysPct * 4} y1="4" x2={sysPct * 4} y2="18"
                  stroke="#888780" strokeWidth="2" strokeDasharray="3 2" />
                {/* Actual dot */}
                <circle cx={actualPct * 4} cy="11" r="5" fill="#1D9E75" />
                {/* Match rate bar */}
                <rect x="0" y="22" width={matchRate * 4} height="4" rx="2" fill="#1D9E75" opacity="0.7" />
                <rect x={matchRate * 4} y="22" width={(100 - matchRate) * 4} height="4" rx="2" fill="#E24B4A" opacity="0.5" />
              </svg>
            </div>

            {/* Meta: GB badge + match % */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '999px',
                background: gb > 0 ? '#d1fae5' : gb < 0 ? '#fee2e2' : '#f1f5f9',
                color: gb > 0 ? '#065f46' : gb < 0 ? '#991b1b' : '#475569'
              }}>{gbLabel} W</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{matchRate}% match</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamStatStrip({ teamTable }) {
  const n = teamTable.length;
  if (n === 0) return null;

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / n;

  const avgGB = avg(teamTable.map(r => Math.abs(parseFloat(r.gb))));
  const avgMatchPct = avg(teamTable.map(r => {
    const total = r.matched + r.mismatched;
    return total > 0 ? (r.matched / total) * 100 : 0;
  }));
  const avgPpsDiff = avg(teamTable.map(r => Math.abs(parseFloat(r.ppsDiff))));
  const avgPppDiff = avg(teamTable.map(r => Math.abs(parseFloat(r.pppDiff))));

  const stats = [
    { label: 'Avg Games Back', value: avgGB.toFixed(1), suffix: '', color: '#475569' },
    { label: 'Avg Match Rate', value: avgMatchPct.toFixed(0), suffix: '%', color: '#10b981' },
    { label: 'Avg PPS Diff', value: avgPpsDiff.toFixed(2), suffix: '', color: '#3b82f6' },
    { label: 'Avg PPP Diff', value: avgPppDiff.toFixed(2), suffix: '', color: '#8b5cf6' },
  ];

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      padding: '20px 8px',
      margin: '24px 0',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px'
    }}>
      {stats.map((s, idx) => (
        <div key={idx} style={{
          textAlign: 'center',
          padding: '8px',
          borderRight: idx < stats.length - 1 ? '1px solid #f1f5f9' : 'none'
        }}>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 'bold',
            color: s.color,
            lineHeight: 1.1
          }}>
            {s.value}{s.suffix}
          </div>
          <div style={{
            fontSize: '0.7rem',
            color: '#94a3b8',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            marginTop: '4px',
            letterSpacing: '0.04em'
          }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
// Helper component for section headers
// ==========================================
// SUB-COMPONENT: REWRITTEN TEAM PROFILE DASHBOARD (TEAM TAB)
// ==========================================
// ==========================================
// SUB-COMPONENT: REWRITTEN TEAM PROFILE DASHBOARD (TEAM TAB)
// ==========================================
function SectionHeader({ title }) {
  return (
    <div style={{
      backgroundColor: '#2c3e50',
      color: 'white',
      padding: '8px 15px',
      fontWeight: 'bold',
      fontSize: '0.95rem',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      marginTop: '20px',
      borderRadius: '4px',
      textAlign: 'center'
    }}>
      {title}
    </div>
  );
}

function MetricRow({ label, offValue, defValue, isHighlighted = false, decimals = 1 }) {
  const formatVal = (val, isPct = false) => {
    if (val === undefined || val === null) return '0.0';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (isPct) return `${num.toFixed(1)}%`;
    return num.toFixed(decimals);
  };

  const isOreb = label === "OREB%";

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 180px 1fr',
      alignItems: 'center',
      padding: '10px 15px',
      borderBottom: '1px solid #e2e8f0',
      backgroundColor: isHighlighted ? '#f8fafc' : 'transparent',
      fontWeight: isHighlighted ? '600' : 'normal'
    }}>
      <div style={{ 
        textAlign: 'right', 
        fontSize: '1.05rem', 
        fontFamily: 'monospace', 
        paddingRight: '30px',
        color: '#2c3e50'
      }}>
        {formatVal(offValue, isOreb)}
      </div>

      <div style={{
        textAlign: 'center',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>

      <div style={{ 
        textAlign: 'left', 
        fontSize: '1.05rem', 
        fontFamily: 'monospace', 
        paddingLeft: '30px',
        color: '#2c3e50'
      }}>
        {formatVal(defValue, isOreb)}
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: SHOT TYPE BOX PLOT + DISTRIBUTION (TEAM TAB)
// Replaces the old "Team Shot Type Breakdown" table. Box plot shows the
// spread of per-game actual PPS for each shot type (dots = individual games,
// dashed line = expected PPS for that type). Bar row below shows that side's
// % of shots by type, column-aligned with the box plot above it.
// ==========================================
{/*const SHOT_TYPES = [6, 4, 7, 3, 1, 0];
const SHOT_LABELS = ["6's", "4's", "7's", "3's", "1's", "0's"];
const EXPECTED_PPS = [1.50, 1.00, 1.75, 0.75, 0.25, 0.00];

function quantile(sortedArr, q) {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sortedArr[base + 1] !== undefined
    ? sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base])
    : sortedArr[base];
}

function boxStats(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    n: sorted.length
  };
}

function ShotSideBoxPlot({ side, ppsArrays, pctValues }) {
  const COL_W = 100, COLS = 6, CHART_W = COL_W * COLS, CHART_H = 200, PAD_TOP = 10, PAD_BOT = 24;
  const allVals = ppsArrays.flat();
  const maxVal = Math.max(0.1, ...allVals, ...EXPECTED_PPS);
  const niceTop = Math.ceil(maxVal * 10) / 10 + 0.2;
  const yPix = (v) => PAD_TOP + (CHART_H - PAD_TOP - PAD_BOT) * (1 - v / niceTop);
  const step = niceTop > 1.5 ? 0.5 : 0.25;
  const gridVals = [];
  for (let v = 0; v <= niceTop; v += step) gridVals.push(v);

  return (
    <div style={{ marginBottom: '8px' }}>
      <svg
        viewBox={`-34 0 ${CHART_W + 10} ${CHART_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Box plot of per-game actual points per shot by shot type for ${side}`}
      >
        {gridVals.map((v, i) => (
          <React.Fragment key={i}>
            <line x1="0" y1={yPix(v)} x2={CHART_W} y2={yPix(v)} stroke="#e0e0e0" strokeWidth="0.5" />
            <text x="-6" y={yPix(v) + 3} textAnchor="end" fontSize="10" fill="#7f8c8d">{v.toFixed(2)}</text>
          </React.Fragment>
        ))}
        {SHOT_TYPES.map((t, i) => {
          const cx = i * COL_W + COL_W / 2;
          const boxW = 36;
          const stats = boxStats(ppsArrays[i]);
          if (!stats) {
            return (
              <text key={t} x={cx} y={CHART_H / 2} textAnchor="middle" fontSize="11" fill="#bbb">no shots</text>
            );
          }
          return (
            <React.Fragment key={t}>
              <line x1={cx} y1={yPix(stats.max)} x2={cx} y2={yPix(stats.q3)} stroke="#0F6E56" strokeWidth="1.2" />
              <line x1={cx} y1={yPix(stats.min)} x2={cx} y2={yPix(stats.q1)} stroke="#0F6E56" strokeWidth="1.2" />
              <line x1={cx - 10} y1={yPix(stats.max)} x2={cx + 10} y2={yPix(stats.max)} stroke="#0F6E56" strokeWidth="1.2" />
              <line x1={cx - 10} y1={yPix(stats.min)} x2={cx + 10} y2={yPix(stats.min)} stroke="#0F6E56" strokeWidth="1.2" />
              <rect x={cx - boxW / 2} y={yPix(stats.q3)} width={boxW} height={Math.max(1, yPix(stats.q1) - yPix(stats.q3))} fill="#9FE1CB" stroke="#0F6E56" strokeWidth="1.2" />
              <line x1={cx - boxW / 2} y1={yPix(stats.median)} x2={cx + boxW / 2} y2={yPix(stats.median)} stroke="#0F6E56" strokeWidth="1.6" />
              <line x1={cx - boxW / 2 - 4} y1={yPix(EXPECTED_PPS[i])} x2={cx + boxW / 2 + 4} y2={yPix(EXPECTED_PPS[i])} stroke="#A32D2D" strokeWidth="2" strokeDasharray="4,3" />
              {ppsArrays[i].map((v, gi) => {
                const jitter = ((gi * 37 % 100) / 100 - 0.5) * boxW * 0.9;
                return <circle key={gi} cx={cx + jitter} cy={yPix(v)} r="2.5" fill="#534AB7" opacity="0.65" />;
              })}
              <text x={cx} y={CHART_H - 6} textAnchor="middle" fontSize="12" fill="#2c3e50">{SHOT_LABELS[i]}</text>
            </React.Fragment>
          );
        })}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', textAlign: 'center', marginTop: '4px' }}>
        {SHOT_TYPES.map((t, i) => {
          const pct = pctValues[i];
          const barMaxH = 50;
          const maxPct = Math.max(...pctValues, 1);
          const h = (pct / maxPct) * barMaxH;
          return (
            <div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#7f8c8d' }}>{pct.toFixed(1)}%</span>
              <div style={{ width: '36px', height: `${barMaxH}px`, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${h}px`, background: '#AFA9EC', borderRadius: '2px 2px 0 0' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>% of shots</div>
    </div>
  );
}

function ShotTypeBoxPlot({ shotPpsLog, shotDistribution }) {
  if (!shotPpsLog || !shotDistribution) return null;
  const offPct = shotDistribution.offense.map(item => parseFloat(item.pct));
  const defPct = shotDistribution.defense.map(item => parseFloat(item.pct));

  return (
    <div style={{ marginTop: '40px', textAlign: 'left' }}>
      <h3 style={{ marginBottom: '20px' }}>Team Shot Type Breakdown</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>Offense</span>
        <span style={{ fontSize: '12px', color: '#7f8c8d' }}>dash = expected PPS &middot; dots = per-game actual PPS</span>
      </div>
      <ShotSideBoxPlot side="offense" ppsArrays={shotPpsLog.offense} pctValues={offPct} />

      <div style={{ marginTop: '24px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>Defense</span>
      </div>
      <ShotSideBoxPlot side="defense" ppsArrays={shotPpsLog.defense} pctValues={defPct} />
    </div>
  );
} */}

// ==========================================
// SUB-COMPONENT: SHOT DISTRIBUTION CHARTS (TEAM TAB)
// Three stacked bars (Offense | League Avg | Defense) showing % of shots per type.
// Two diverging bar charts below (Offense, Defense) showing actual PPS minus expected PPS.
// Shot type order: 7/11s → 6s → 4s → 3s → 1s → 0s (highest to lowest expected PPS).
// ==========================================
const SHOT_LABELS = ["7/11's", "6's", "4's", "3's", "1's", "0's"];
const SHOT_KEYS   = ['7/11', 6, 4, 3, 1, 0];
const EXPECTED_PPS = { '7/11': 1.75, 6: 1.50, 4: 1.00, 3: 0.75, 1: 0.25, 0: 0.00 };
// Matches the PieChart palette on the Games tab
const SHOT_COLORS = { '7/11': '#2c3e50', 6: '#32CD32', 4: '#2980b9', 3: '#e67e22', 1: '#FF0000', 0: '#000000' };
//colors =  '#32CD32', '#2980b9', '#2c3e50', '#e67e22', '#FF0000', '#000000'
// Stack order (bottom -> top) as requested: High = 6, 4, 7/11 | Low = 3, 0, 1
const HIGH_STACK_ORDER = [6, 4, '7/11'];
const LOW_STACK_ORDER  = [3, 0, 1];

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;

  r = Math.round((target - r) * p) + r;
  g = Math.round((target - g) * p) + g;
  b = Math.round((target - b) * p) + b;

  return `#${(1 << 24 | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Perceived brightness, 0 (black) -> 1 (white)
function getLuminance(hex) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Returns [lightest, mid, darkest] shades of a color.
// If the color is already near-white or near-black, shifts the whole
// trio in the one direction that still has visible room, so all 3
// stay distinguishable instead of clipping to the same value.
function getShadeTrio(hex) {
  const lum = getLuminance(hex);
  let percents;

  if (lum > 0.85) {
    percents = [-10, -30, -50];      // near-white: only darken
  } else if (lum < 0.15) {
    percents = [50, 30, 10];         // near-black: only lighten
  } else {
    percents = [25, 0, -25];         // normal: spread both directions
  }

  return percents.map(p => shadeColor(hex, p));
}

// Builds the 6-key SHOT_COLORS-style object for a given team,
// using primary shades for the High Quality tier and secondary
// shades for the Low Quality tier.
function generateTeamShotColors(teamName) {
  const team = TEAM_COLORS[teamName];
  if (!team) return null;

  const [primaryLight, primaryMid, primaryDark] = getShadeTrio(team.primary);
  const [secondaryLight, secondaryMid, secondaryDark] = getShadeTrio(team.secondary);

  return {
    '7/11': primaryDark,     // highest-value High Quality shot -> boldest shade
    6:      primaryMid,
    4:      primaryLight,
    3:      secondaryDark,   // highest-value Low Quality shot -> boldest shade
    1:      secondaryMid,
    0:      secondaryLight,
  };
}
// Stack order (bottom -> top) as requested: High = 6, 4, 7/11 | Low = 3, 0, 1
//const HIGH_STACK_ORDER = [6, 4, '7/11'];
//const LOW_STACK_ORDER  = [3, 0, 1];

function ShotDistributionCharts({ shotDistribution, shotPpsLog, leagueAvgDist, teamName }) {
  if (!shotDistribution || !shotPpsLog) return null;

  const teamAccent = TEAM_COLORS[teamName] || { primary: '#378ADD', secondary: '#888780' };

  //const SHOT_COLORS = generateTeamShotColors(teamName) || FALLBACK_SHOT_COLORS;

  const parsePct = (pctStr) => parseFloat(pctStr) || 0;

  // Build a lookup of type -> pct for a given distribution array
  const toPctMap = (distArray, isLeagueAvg = false) =>
    Object.fromEntries(
      (distArray || []).map(d => [String(d.type), isLeagueAvg ? d.pct : parsePct(d.pct)])
    );

  const offensePctMap = toPctMap(shotDistribution.offense);
  const leaguePctMap  = toPctMap(leagueAvgDist, true);
  const defensePctMap = toPctMap(shotDistribution.defense);

  // Build the 3-row (Offense / League Average / Defense) dataset for a single quality tier's mini chart.
  // Only includes keys relevant to that tier, so tooltips don't show the other tier's 0% entries.
  const buildTierData = (qualityKeys) => ([
    { name: 'Offense',        ...Object.fromEntries(qualityKeys.map(k => [String(k), offensePctMap[String(k)] ?? 0])) },
    { name: 'Average', ...Object.fromEntries(qualityKeys.map(k => [String(k), leaguePctMap[String(k)] ?? 0])) },
    { name: 'Defense',        ...Object.fromEntries(qualityKeys.map(k => [String(k), defensePctMap[String(k)] ?? 0])) },
  ]);

  const highQualityData = buildTierData(HIGH_STACK_ORDER);
  const lowQualityData  = buildTierData(LOW_STACK_ORDER);

  // --- Diverging chart data: actual PPS minus expected ---
  const makeDeltaData = (distSide) => distSide.map(d => {
    const exp = EXPECTED_PPS[d.type] ?? 0;
    const actual = parseFloat(d.pps) || 0;
    const delta = parseFloat((actual - exp).toFixed(3));
    return { name: d.type === '7/11' ? "7/11's" : `${d.type}'s`, delta, actual, exp };
  });

  const offDelta = makeDeltaData(shotDistribution.offense);
  const defDelta = makeDeltaData(shotDistribution.defense);

  const barStyle = { fontSize: '12px', fill: '#2c3e50' };
  const axisStyle = { fontSize: '11px', fill: '#7f8c8d' };

  // Custom tooltip: shows Total (%) above the individual shot-type breakdown
  const TierTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
    return (
      <div style={{ fontSize: '12px', borderRadius: '4px', border: '1px solid #ddd', background: '#fff', padding: '8px 10px' }}>
        <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontWeight: '700', color: '#1a2332', marginBottom: '4px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
          Total: {total.toFixed(1)}%
        </div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: '#2c3e50' }}>
            <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '2px', background: p.color, marginRight: '5px' }} />
            {p.name === '7/11' ? "7/11's" : `${p.name}'s`}: {p.value.toFixed(1)}%
          </div>
        ))}
      </div>
    );
  };

  const GroupBarChart = ({ data, title, stackOrder, showYAxis }) => (
    <div style={{ flex: 1}}>
    {/*<div style={{ flex: 1, borderTop: `3px solid ${teamAccent.primary}`, paddingTop: '8px' }}>*/}
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#2c3e50', marginBottom: '6px' }}>{title}</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: showYAxis ? 0 : -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8e8" />
          <XAxis dataKey="name" tick={barStyle} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={showYAxis ? axisStyle : false}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<TierTooltip />} />
          {stackOrder.map(k => (
            <Bar key={k} dataKey={String(k)} stackId="a" fill={SHOT_COLORS[k]} name={String(k)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const DivergingChart = ({ data, title }) => (
    <div style={{ flex: 1 }}>
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '500', color: '#2c3e50', marginBottom: '6px' }}>{title}</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 16, left: 16, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8e8" />
          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
          <ReferenceLine y={0} stroke="#2c3e50" strokeWidth={1.5} />
          <Tooltip
            formatter={(val, name, props) => [`${val > 0 ? '+' : ''}${val.toFixed(3)} (actual: ${props.payload.actual.toFixed(3)})`, 'vs Expected']}
            contentStyle={{ fontSize: '12px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <Bar dataKey="delta" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.delta >= 0 ? 'green' : 'red'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div style={{
        //border: `4px solid ${teamAccent.primary}`,
        borderRadius: '8px',
        padding: '12px',
        width: '100%',
        minWidth: 0,        // <-- critical if this card is itself inside a flex/grid parent
        boxSizing: 'border-box',
        overflow: 'hidden'  // safety net: clips anything that still tries to overflow
      }}>
      <style>{`
        .shot-charts-row {
          display: flex;
          gap: 16px;
          min-width: 0
        }
        .shot-chart-item {
          flex: 1;
          min-width: 0; /* prevents flex children from overflowing their parent */
        }
        @media (max-width: 640px) {
          .shot-charts-row {
            flex-direction: column;
          }
          .shot-chart-item {
            
            border-radius: 8px;
            padding: 8px;
            margin-bottom: 4px;
          }
        }
      `}</style>
      <h3 style={{
        marginBottom: '6px',
        fontSize: '1.2rem',
        fontWeight: '700',
        color: '#1a2332',
        letterSpacing: '0.2px',
      }}>
        Team Shot Type Breakdown
      </h3>
      {/*<div style={{ height: '3px', width: '48px', background: '#378ADD', borderRadius: '2px', marginBottom: '16px' }} />
      <div style={{ height: '3px', width: '48px', background: teamAccent.primary, borderRadius: '2px', marginBottom: '16px' }} />*/}
      {/* Stacked distribution: one mini chart per quality tier, Offense/League Avg/Defense bars */}
      <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#1a2332', textAlign: 'center', fontWeight: '700' }}>
        Shot Distribution (%)
      </div>
      <div className="shot-charts-row">
        <div className="shot-chart-item">
          <GroupBarChart data={highQualityData} title="High Quality" stackOrder={HIGH_STACK_ORDER} showYAxis={true} />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            {HIGH_STACK_ORDER.map(k => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2c3e50' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '2px', background: SHOT_COLORS[k], display: 'inline-block' }} />
                {k === '7/11' ? "7/11's" : `${k}'s`}
              </span>
            ))}
          </div>
        </div>
        <div className="shot-chart-item">
          <GroupBarChart data={lowQualityData} title="Low Quality" stackOrder={LOW_STACK_ORDER} showYAxis={true} />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            {LOW_STACK_ORDER.map(k => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2c3e50' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '2px', background: SHOT_COLORS[k], display: 'inline-block' }} />
                {k}'s
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Diverging PPS delta charts */}
      <div style={{ marginTop: '12px', marginBottom: '8px', fontSize: '0.9rem', color: '#1a2332', textAlign: 'center', fontWeight: '700' }}>
        Actual PPS vs. Expected PPS
        <p>(<span style={{ color: 'green' }}>Green=Above</span>, <span style={{ color: 'red' }}>Red=Below</span>)</p>
      </div>
      <div className="shot-charts-row">
        <div className="shot-chart-item">
          <DivergingChart data={offDelta} title="Offense" />
        </div>
        <div className="shot-chart-item">
          <DivergingChart data={defDelta} title="Defense" />
        </div>
      </div>

      {/* Old table kept for reference:
      <ShotTypeBoxPlot shotPpsLog={shotPpsLog} shotDistribution={shotDistribution} />
      */}
    </div>
  );
}



function TeamProfileDashboard({ teamData, systemRecord = "0-0", accentColor = "#16a085" }) {
  if (!teamData) return null;

  const name = teamData.teamName || "Selected Team";
  const actualRec = teamData.record || "0-0";
  const logoSrc = `/MEC Logos/${name}.png`;

  const off = teamData.off || {};
  const def = teamData.def || {};

  const offSystemScore = off.sysG;
  const defSystemScore = def.sysG;
  
  // Adjusted properties to pull correctly from .ptsG
  const offPPG = off.ptsG || 0; 
  const defPPG = def.ptsG || 0; 
  
  const offPossessions = off.possG;
  const defPossessions = def.possG;
  const margin = teamData.shot_margin || 0;

  const offShotsGained = teamData.shotsGained100 || 0;
  const defShotsGained = teamData.shotsGained100d || 0;
  const offOreb = off.oRebPct;
  const defOreb = def.oRebPct;
  const offFtReb = off.ftRebG;
  const defFtReb = def.ftRebG;

  const offShotQual = off.shot_q;
  const defShotQual = def.shot_q;
  const offStintQual = off.stint_q;
  const defStintQual = def.stint_q;
  const offResultQual = off.result_q;
  const defResultQual = def.result_q;

  const getExpectedPPS = (sq) => {
    const num = parseFloat(sq);
    return isNaN(num) ? 0 : num / 4;
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '850px',
      margin: '0 auto',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: `4px solid ${accentColor}`,
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
      overflow: 'hidden'
    }}>
      {/* 1. Top Executive Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 30px',
        backgroundColor: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img 
            src={logoSrc} 
            alt={`${name} Logo`} 
            style={{ width: '60px', height: '60px', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#2c3e50', fontWeight: '800' }}>
            {name}
          </h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
            Team Records
          </span>
          <div style={{ fontSize: '1.15rem', color: '#2c3e50', fontWeight: '700', marginTop: '2px' }}>
            Actual Record: <span style={{ color: '#16a085' }}>{actualRec}</span>
            <span style={{ margin: '0 10px', color: '#cbd5e0' }}>|</span>
            System Record: <span style={{ color: '#2980b9' }}>{systemRecord}</span>
          </div>
        </div>
      </div>

      {/* Column Section Headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 1fr',
        padding: '15px 15px 5px 15px',
        fontWeight: 'bold',
        fontSize: '1.1rem',
        color: '#1e293b'
      }}>
        <div style={{ textAlign: 'center', borderBottom: '3px solid #1abc9c', paddingBottom: '6px', margin: '0 15px' }}>
          ⚔️ OFFENSE
        </div>
        <div></div>
        <div style={{ textAlign: 'center', borderBottom: '3px solid #e74c3c', paddingBottom: '6px', margin: '0 15px' }}>
          🛡️ DEFENSE
        </div>
      </div>

      {/* 2. Metrics Presentation Matrix Container */}
      <div style={{ padding: '10px 20px 25px 20px', textAlign:'center'}}>
        
        {/* "Overall" Section */}
        <SectionHeader title="Overall"/>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <MetricRow label="System Score" offValue={offSystemScore} defValue={defSystemScore} isHighlighted={true} decimals={1} />
          <MetricRow label="PPG" offValue={offPPG} defValue={defPPG} decimals={1} />
          <MetricRow label="Possessions" offValue={offPossessions} defValue={defPossessions} decimals={1} />
          <MetricRow label="Shot Margin" offValue={margin} defValue={margin} decimals={1} />
        </div>

        {/* "More" Section */}
        <SectionHeader title="More" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <MetricRow label="Shots Gained/100" offValue={offShotsGained} defValue={defShotsGained} decimals={2} />
          <MetricRow label="OREB%" offValue={offOreb} defValue={defOreb} />
          <MetricRow label="FT Reb" offValue={offFtReb} defValue={defFtReb} decimals={1} />
        </div>

        {/* "Better" Section */}
        <SectionHeader title="Better" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <MetricRow label="Shot Quality" offValue={offShotQual} defValue={defShotQual} isHighlighted={true} decimals={2} />
          <MetricRow label="Expected PPS" offValue={getExpectedPPS(offShotQual)} defValue={getExpectedPPS(defShotQual)} decimals={2} />
          <MetricRow label="Stint Quality" offValue={offStintQual} defValue={defStintQual} decimals={2} />
          <MetricRow label="Result Quality" offValue={offResultQual} defValue={defResultQual} decimals={2} />
        </div>

      </div>
    </div>
  );
}
// ==========================================
// MAIN APP COMPONENT EXPORT
// ==========================================
function App() {
  const [activeTab, setActiveTab] = useState('System');
  const [gameData, setGameData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plays, setPlays] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeamStats, setSelectedTeamStats] = useState(null);
  const [gameSummary, setGameSummary] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [leagueSummary, setLeagueSummary] = useState([]);
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [leagueAvgDist, setLeagueAvgDist] = useState(null);
  // Layout refinement settings
  const [viewMode, setViewMode] = useState('coach'); 
  const [periodMetric, setPeriodMetric] = useState('systemScore'); 
  const [possessionMetric, setPossessionMetric] = useState('systemScore');

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
    if (activeTab === 'Team' && !leagueAvgDist) {
          axios.get(`${API_BASE_URL}/api/league-averages`)
            .then(res => setLeagueAvgDist(res.data))
            .catch(err => console.error("Error fetching league averages:", err));
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
      .then(res => setSelectedTeamStats(res.data))
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
    if ((activeTab === 'System' || activeTab === 'Team') && !systemStats) {
      axios.get(`${API_BASE_URL}/api/system-accuracy`)
        .then(res => setSystemStats(res.data))
        .catch(err => console.error("System Tab Error:", err)); 
    }
  }, [activeTab, systemStats]);

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

  // ==========================================
  // SECTION 4: CHART DATA PIPELINE (CLEANED & UNIFIED)
  // ==========================================
  const chartPeriodStats = useMemo(() => {
    const validPlays = plays.filter(p => p.system_sequence && p.system_sequence.trim() !== "");
    const periods = {};
    
    // Initialize structure containing points tracking
    const initStats = () => ({ poss: 0, system: 0, shots: 0, totalQual: 0, points: 0 });

    validPlays.forEach(play => {
      const per = play.period;
      const team = play.team_type; 
      if (!periods[per]) periods[per] = { Home: initStats(), Away: initStats() };

      // Accumulate actual points scored from play values safely
      const pointsScored = play.points ?? play.pts ?? 0;
      periods[per][team].points += pointsScored;

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

    return Object.keys(periods).sort((a, b) => Number(a) - Number(b)).map(per => {
      let label = per === '1' ? '1st' : per === '2' ? '2nd' : `OT${parseInt(per) - 2}`;
      const h = periods[per].Home;
      const a = periods[per].Away;

      let homeVal = 0, awayVal = 0;
      if (periodMetric === 'systemScore') { homeVal = h.system; awayVal = a.system; }
      else if (periodMetric === 'shotMargin') { homeVal = h.shots - a.shots; awayVal = a.shots - h.shots; }
      else if (periodMetric === 'shotQuality') { homeVal = h.shots > 0 ? h.totalQual / h.shots : 0; awayVal = a.shots > 0 ? a.totalQual / a.shots : 0; }
      else if (periodMetric === 'possVolume') { homeVal = h.poss; awayVal = a.poss; }
      else if (periodMetric === 'actualPoints') { homeVal = h.points; awayVal = a.points; }

      return { 
        period: label, 
        [gameSummary?.Home?.name || "Home"]: parseFloat(homeVal.toFixed(2)), 
        [gameSummary?.Away?.name || "Away"]: parseFloat(awayVal.toFixed(2)) 
      };
    });
  }, [plays, periodMetric, gameSummary]);

  // Section 5 Chart Data Pipeline
  // Section 4 Timeline Data Pipeline
  // ==========================================
  // SECTION 4: TIMELINE DATA PIPELINE (RESTORED BIN LOGIC)
  // ==========================================
  // ==========================================
  // SECTION 4: CHRONOLOGICAL POSSESSION CHUNKING (BINS OF 20)
  // ==========================================
  const chartPossessionStats = useMemo(() => {
    // 1. Isolate every play that counts as an actual possession instance
    const validPlays = plays.filter(p => p.system_sequence && p.system_sequence.trim() !== "");
    
    // This tracker will hold dynamically created bins (e.g., bin 0 = Possessions 1-20, bin 1 = 21-40)
    const binsMap = {};

    // Process every single possession chronologically as it happened in the game
    validPlays.forEach((play, index) => {
      // Create a 1-based chronological number for the possession instance
      const absolutePossessionNum = index + 1; 
      
      // Determine which bucket of 20 this possession belongs to
      const binIndex = Math.floor((absolutePossessionNum - 1) / 20);
      
      // Define a clear, clean label for your Timeline chart's X-Axis
      const startRange = binIndex * 20 + 1;
      const endRange = startRange + 19;
      const binLabel = `${startRange}-${endRange}`;

      // Initialize the bin structure if it's the first time hitting this bucket range
      if (!binsMap[binIndex]) {
        binsMap[binIndex] = {
          binKey: binIndex,
          label: binLabel,
          Home: { system: 0, shots: 0, totalQual: 0, poss: 0, points: 0 },
          Away: { system: 0, shots: 0, totalQual: 0, poss: 0, points: 0 }
        };
      }

      const team = play.team_type; // Expects 'Home' or 'Away'
      if (binsMap[binIndex][team]) {
        const teamObj = binsMap[binIndex][team];
        
        // Always increment the possession count for the team that took it
        teamObj.poss++;

        // Track actual scoreboard points scored inside this chunk
        const ptsScored = play.points ?? play.pts ?? 0;
        teamObj.points += ptsScored;

        // Parse system sequences for quality ratings
        const pData = parseSequence(play.system_sequence);
        if (pData) {
          teamObj.system += (pData.lastQuality + pData.rebounds);
          pData.events.forEach(e => {
            if (e.type === 'shot') {
              teamObj.shots++;
              teamObj.totalQual += e.quality;
            }
          });
        }
      }
    });

    // 2. Format the grouped chunks cleanly into an array sorted by chronology
    return Object.keys(binsMap)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => {
        const b = binsMap[key];
        let homeVal = 0, awayVal = 0;

        // Route the interactive dropdown metric state selection
        if (possessionMetric === 'systemScore') {
          homeVal = b.Home.system;
          awayVal = b.Away.system;
        } else if (possessionMetric === 'shotQuality') {
          homeVal = b.Home.shots > 0 ? b.Home.totalQual / b.Home.shots : 0;
          awayVal = b.Away.shots > 0 ? b.Away.totalQual / b.Away.shots : 0;
        } else if (possessionMetric === 'shotMargin') {
          homeVal = b.Home.shots - b.Away.shots;
          awayVal = b.Away.shots - b.Home.shots;
        } else if (possessionMetric === 'possVolume') {
          homeVal = b.Home.poss;
          awayVal = b.Away.poss;
        } else if (possessionMetric === 'actualPoints') {
          homeVal = b.Home.points;
          awayVal = b.Away.points;
        }

        // Defensive protection to guarantee no undefined/NaN values leak into .toFixed()
        const safeHome = typeof homeVal === 'number' && !isNaN(homeVal) ? homeVal : 0;
        const safeAway = typeof awayVal === 'number' && !isNaN(awayVal) ? awayVal : 0;

        return {
          bin: b.label, // This passes strings like "Poss 1-20", "Poss 21-40" straight to Recharts
          [gameSummary?.Home?.name || "Home"]: parseFloat(safeHome.toFixed(2)),
          [gameSummary?.Away?.name || "Away"]: parseFloat(safeAway.toFixed(2))
        };
      });
  }, [plays, possessionMetric, gameSummary]);


  // Traditional Table Processors (Maintained for Classic View)
  const getScoringByPeriod = () => {
    const validPlays = plays.filter(p => p.system_sequence && p.system_sequence.trim() !== "");
    const periods = {};
    const initTeamStats = () => ({ poss: 0, system: 0, shots: 0, totalQual: 0 });

    validPlays.forEach(play => {
      const per = play.period; const team = play.team_type;
      if (!periods[per]) periods[per] = { Home: initTeamStats(), Away: initTeamStats() };
      const pData = parseSequence(play.system_sequence);
      if (pData) {
        periods[per][team].poss++;
        periods[per][team].system += (pData.lastQuality + pData.rebounds);
        pData.events.forEach(e => { if (e.type === 'shot') { periods[per][team].shots++; periods[per][team].totalQual += e.quality; } });
      }
    });
    return Object.keys(periods).sort((a, b) => a - b).map(per => ({
      period: per === '1' ? '1st' : per === '2' ? '2nd' : `OT${parseInt(per) - 2}`, Home: periods[per].Home, Away: periods[per].Away
    }));
  };

  const getScoringByPossessions = () => {
    const validPlays = plays.filter(p => p.system_sequence && p.system_sequence.trim() !== "");
    const bins = [
      { min: 1, max: 20, label: '1-20' }, { min: 21, max: 40, label: '21-40' }, { min: 41, max: 60, label: '41-60' },
      { min: 61, max: 80, label: '61-80' }, { min: 81, max: 100, label: '81-100' }, { min: 101, max: 999, label: '100+' }
    ];
    const initTeamStats = () => ({ poss: 0, system: 0, shots: 0, totalQual: 0 });
    const binnedData = bins.map(b => ({ label: b.label, Home: initTeamStats(), Away: initTeamStats(), hasData: false }));

    validPlays.forEach((play, index) => {
      const chronologicalCount = index + 1; const team = play.team_type;
      const targetBin = bins.findIndex(b => chronologicalCount >= b.min && chronologicalCount <= b.max);
      if (targetBin !== -1) {
        binnedData[targetBin].hasData = true;
        const pData = parseSequence(play.system_sequence);
        if (pData) {
          binnedData[targetBin][team].poss++; binnedData[targetBin][team].system += (pData.lastQuality + pData.rebounds);
          pData.events.forEach(e => { if (e.type === 'shot') { binnedData[targetBin][team].shots++; binnedData[targetBin][team].totalQual += e.quality; } });
        }
      }
    });
    return binnedData.filter(b => b.hasData);
  };

  const periodStats = getScoringByPeriod();
  const possessionStats = getScoringByPossessions();
  const totalPeriodHome = periodStats.reduce((acc, curr) => { acc.poss += curr.Home.poss; acc.system += curr.Home.system; acc.shots += curr.Home.shots; acc.totalQual += curr.Home.totalQual; return acc; }, { poss: 0, system: 0, shots: 0, totalQual: 0 });
  const totalPeriodAway = periodStats.reduce((acc, curr) => { acc.poss += curr.Away.poss; acc.system += curr.Away.system; acc.shots += curr.Away.shots; acc.totalQual += curr.Away.totalQual; return acc; }, { poss: 0, system: 0, shots: 0, totalQual: 0 });

  return (
    <div className="App">
      <header>
        <h1 className="main-title">Shot Quality Scoring System Dashboard</h1>
        <nav>
          {['System', 'Team', 'Games', 'League'].map(tab => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => { setActiveTab(tab); setPlays([]); setGameSummary(null); setSelectedTeamStats(null); }}>
              {tab}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {/* ========================================================= */}
        {/* REWRITTEN INTERACTIVE COACH-CENTRIC GAMES TAB              */}
        {/* ========================================================= */}
        {activeTab === 'Games' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'center' }}>
            
            {/* Control Strip: Game Picker & Layout Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ width: '300px' }}>
                <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontWeight: '500' }} onChange={(e) => { fetchPlays(e.target.value); fetchGameSummary(e.target.value); }}>
                  <option value="">Select a Game</option>
                  {gameData.map(game => (
                    <option key={game.game_id} value={game.game_id}>
                      {game.date} - {game.home_team} vs {game.away_team}
                    </option>
                  ))}
                </select>
              </div>
              
              {/*plays.length > 0 && (
                <button 
                  onClick={() => setViewMode(viewMode === 'coach' ? 'classic' : 'coach')}
                  style={{ padding: '8px 16px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  {viewMode === 'coach' ? '📋 Switch to Classic Tables' : '📊 Switch to Coach Charts'}
                </button>
              )*/}
            </div>

            {plays.length > 0 ? (
              viewMode === 'coach' ? (
                /* NEW INTERACTIVE VIEW HOOKS */
                <div className="coach-dashboard-layout" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <h3 style={{ margin: '0 0 5px 0', textAlign: 'center', fontSize: '1.4rem', fontWeight: 'bold', color: '#2c3e50' }}>Game Summary</h3>
                  {/* Section 1: Top Dashboard Grid */}
                  <ExecutiveMatchup gameData={gameSummary} winProbability={62} />

                  {/* Sections 2 & 3: Pies & Execution Bars */}
                  <ShotDistributionAndExecution gameSummary={gameSummary} />

                  {/* NEW ROW: RUNS SECTIONS 3 & 4 IN PERFECT SIDE-BY-SIDE HARMONY */}
                  <div className="coach-card filter-control-bar" style={{ marginBottom: '15px', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <label htmlFor="coach-metric-select" style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '1rem' }}> 
                      📊 View Analytics By: 
                    </label>
                    <select 
                      id="coach-metric-select" 
                      value={periodMetric} 
                      onChange={(e) => {
                        const selected = e.target.value;
                        setPeriodMetric(selected);      // Updates the period chart matrix
                        setPossessionMetric(selected);  // ✅ FIX: Updates the timeline chart matrix simultaneously
                      }} 
                      style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e0', fontWeight: 'bold', backgroundColor: 'white', color: '#2c3e50', cursor: 'pointer' }}
                    >
                      <option value="systemScore">System Score</option>
                      <option value="shotQuality">Shot Quality</option>
                      <option value="shotMargin">Shot Margin</option>
                      <option value="possVolume">Possessions</option>
                      <option value="actualPoints">Points</option>
                    </select>
                  </div>

                  {/* SIDE-BY-SIDE CHART LAYOUT */}
                  <div className="dashboard-analytics-row">
                    <PerformanceByPeriod 
                      periodStats={chartPeriodStats} 
                      homeName={gameSummary?.Home?.name || "Home"} 
                      awayName={gameSummary?.Away?.name || "Away"}
                      activeMetricLabel={
                        periodMetric === 'poss' ? 'Possessions' :
                        periodMetric === 'system' ? 'System Score' :
                        periodMetric === 'sQual' ? 'Shot Quality' :
                        periodMetric === 'score' ? 'Actual Points' : 'Shot Margin'
                      }
                      activeMetricLabel={getMetricLabel(periodMetric)}
                    />
                    <PossessionStintTimeline 
                      timelineData={chartPossessionStats} 
                      homeName={gameSummary?.Home?.name || "Home"} 
                      awayName={gameSummary?.Away?.name || "Away"} 
                      activeMetricLabel={
                        periodMetric === 'poss' ? 'Possessions' :
                        periodMetric === 'system' ? 'System Score' :
                        periodMetric === 'sQual' ? 'Shot Quality' :
                        periodMetric === 'score' ? 'Actual Points' : 'Shot Margin'
                      }
                      activeMetricLabel={getMetricLabel(periodMetric)}
                    />
                  </div>

                  {/* SECTION 6: DETAILED PLAY-BY-PLAY TABLE AT ABSOLUTE BOTTOM */}
                  <div className="coach-card" style={{ padding: '15px 20px' }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>Detailed Game Play-by-Play Log</h3>
                    <div style={{ maxHeight: '250px', overflowY: 'scroll', border: '1px solid #ddd', borderRadius: '6px' }}>
                      <table className="play-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0, fontSize: '0.8rem' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#2c3e50', color: 'white', zIndex: 1 }}>
                          <tr>
                            <th style={{ padding: '6px', borderBottom: '2px solid #1abc9c' }}>Period</th>
                            <th style={{ padding: '6px', borderBottom: '2px solid #1abc9c' }}>Team</th>
                            <th style={{ padding: '6px', borderBottom: '2px solid #1abc9c' }}>Sequence</th>
                            <th style={{ padding: '6px', borderBottom: '2px solid #1abc9c' }}>Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plays.map((play, index) => {
                            const teamName = play.team_type === 'Home' ? gameSummary?.Home?.name : gameSummary?.Away?.name;
                            return (
                              <tr key={index} style={play.system_sequence === "" ? { opacity: 0.4, backgroundColor: '#fcfcfc', textAlign: 'center' } : { textAlign: 'center' }}>
                                <td style={{ padding: '5px' }}>{play.period}</td>
                                <td style={{ padding: '5px', fontWeight: '500' }}>{teamName}</td>
                                <td style={{ padding: '5px', letterSpacing: '1px' }}>{play.system_sequence || '—'}</td>
                                <td style={{ padding: '5px', fontWeight: 'bold' }}>{play.system_sequence ? play.points : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : (
                /* CLASSIC THREE-COLUMN GRID VIEW */
                <div className="games-tab-grid">
                  {/* Column 1: Classic Left Table (Play-By-Play Side Panel) */}
                  <div style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.8rem', width: '100%' }}>
                    <table className="play-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#2c3e50', color: 'white', zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: '3px', borderBottom: '2px solid #1abc9c' }}>Period</th>
                          <th style={{ padding: '3px', borderBottom: '2px solid #1abc9c' }}>Team</th>
                          <th style={{ padding: '3px', borderBottom: '2px solid #1abc9c' }}>Sequence</th>
                          <th style={{ padding: '3px', borderBottom: '2px solid #1abc9c' }}>Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plays.map((play, index) => {
                          const teamLabel = play.team_type === 'Home' ? gameSummary?.Home?.name : gameSummary?.Away?.name;
                          return (
                            <tr key={index} style={play.system_sequence === "" ? { opacity: 0.4, backgroundColor: '#fcfcfc' } : { textAlign: 'center' }}>
                              <td>{play.period}</td>
                              <td className="team-badge" style={{fontSize: '0.7rem'}}>{teamLabel}</td>
                              <td>{play.system_sequence || '—'}</td>
                              <td>{play.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Column 2: Classic Center Tables (Period & Possession Splitting) */}
                  <div style={{ flex: 1.8, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0' }}>Scoring by Period</h3>
                      <div style={{ overflowX: 'auto', width: '100%' }}>
                        <table className="play-table" style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                              <th>Period</th><th>Team</th><th>Poss.</th><th>System Score</th><th>Shot Margin</th><th>Shot Quality</th>
                            </tr>
                          </thead>
                          <tbody>
                            {periodStats.map((row, idx) => (
                              <React.Fragment key={idx}>
                                <tr style={{ borderTop: '2px solid #ccc', textAlign: 'center' }}>
                                  <td rowSpan="2" style={{ fontWeight: 'bold', backgroundColor: '#fafafa', borderRight: '1px solid #ddd', verticalAlign: 'middle' }}>{row.period}</td>
                                  <td>Home</td><td>{row.Home.poss}</td><td>{row.Home.system.toFixed(0)}</td>
                                  <td>{(row.Home.shots - row.Away.shots) >= 0 ? `+${row.Home.shots - row.Away.shots}` : row.Home.shots - row.Away.shots}</td>
                                  <td>{row.Home.shots > 0 ? (row.Home.totalQual / row.Home.shots).toFixed(2) : '0.00'}</td>
                                </tr>
                                <tr style={{ backgroundColor: '#f9f9f9', textAlign: 'center' }}>
                                  <td>Away</td><td>{row.Away.poss}</td><td>{row.Away.system.toFixed(0)}</td>
                                  <td>{(row.Away.shots - row.Home.shots) >= 0 ? `+${row.Away.shots - row.Home.shots}` : row.Away.shots - row.Home.shots}</td>
                                  <td>{row.Away.shots > 0 ? (row.Away.totalQual / row.Away.shots).toFixed(2) : '0.00'}</td>
                                </tr>
                              </React.Fragment>
                            ))}
                            <tr style={{ borderTop: '3px double #2c3e50', fontWeight: 'bold', backgroundColor: '#eaeded', textAlign: 'center' }}>
                              <td rowSpan="2" style={{ verticalAlign: 'middle', borderRight: '1px solid #ddd' }}>Total</td><td>Home</td><td>{totalPeriodHome.poss}</td><td>{totalPeriodHome.system.toFixed(0)}</td>
                              <td>{(totalPeriodHome.shots - totalPeriodAway.shots) >= 0 ? `+${totalPeriodHome.shots - totalPeriodAway.shots}` : totalPeriodHome.shots - totalPeriodAway.shots}</td>
                              <td>{totalPeriodHome.shots > 0 ? (totalPeriodHome.totalQual / totalPeriodHome.shots).toFixed(2) : '0.00'}</td>
                            </tr>
                            <tr style={{ fontWeight: 'bold', backgroundColor: '#eaeded', textAlign: 'center' }}>
                              <td>Away</td><td>{totalPeriodAway.poss}</td><td>{totalPeriodAway.system.toFixed(0)}</td>
                              <td>{(totalPeriodAway.shots - totalPeriodHome.shots) >= 0 ? `+${totalPeriodAway.shots - totalPeriodHome.shots}` : totalPeriodAway.shots - totalPeriodHome.shots}</td>
                              <td>{totalPeriodAway.shots > 0 ? (totalPeriodAway.totalQual / totalPeriodAway.shots).toFixed(2) : '0.00'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ margin: '0 0 6px 0' }}>Scoring by Possessions</h3>
                      <div style={{ overflowX: 'auto', width: '100%' }}>     
                        <table className="play-table" style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                              <th>Poss.</th><th>Team</th><th>Poss.</th><th>System Score</th><th>Shot Margin</th><th>Shot Quality</th>
                            </tr>
                          </thead>
                          <tbody>
                            {possessionStats.map((row, idx) => (
                              <React.Fragment key={idx}>
                                <tr style={{ borderTop: '2px solid #ccc', textAlign: 'center' }}>
                                  <td rowSpan="2" style={{ fontWeight: 'bold', backgroundColor: '#fafafa', borderRight: '1px solid #ddd', verticalAlign: 'middle' }}>{row.label}</td>
                                  <td>Home</td><td>{row.Home.poss}</td><td>{row.Home.system.toFixed(0)}</td>
                                  <td>{(row.Home.shots - row.Away.shots) >= 0 ? `+${row.Home.shots - row.Away.shots}` : row.Home.shots - row.Away.shots}</td>
                                  <td>{row.Home.shots > 0 ? (row.Home.totalQual / row.Home.shots).toFixed(2) : '0.00'}</td>
                                </tr>
                                <tr style={{ backgroundColor: '#f9f9f9', textAlign: 'center' }}>
                                  <td>Away</td><td>{row.Away.poss}</td><td>{row.Away.system.toFixed(0)}</td>
                                  <td>{(row.Away.shots - row.Home.shots) >= 0 ? `+${row.Away.shots - row.Home.shots}` : row.Away.shots - row.Home.shots}</td>
                                  <td>{row.Away.shots > 0 ? (row.Away.totalQual / row.Away.shots).toFixed(2) : '0.00'}</td>
                                </tr>
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Classic Right Table (Game Summary Sidebar) */}
                  {gameSummary && (
                    <div style={{ width: '100%', backgroundColor: '#f4f4f4', padding: '12px', borderRadius: '8px', height: 'fit-content', boxSizing: 'border-box' }}>
                      <h3>Game Summary</h3>
                      <table className="play-table" style={{ width: '100%' }}>
                        <thead>
                          <tr><th style={{ width: '120px' }}>Metric</th><th>Home</th><th>Away</th></tr>
                        </thead>
                        <tbody>
                          <tr style={{ fontWeight: 'bold', backgroundColor: '#eee' }}><td>Team</td><td>{gameSummary.Home.name}</td><td>{gameSummary.Away.name}</td></tr>
                          <tr><td>System Score</td><td>{gameSummary.Home.system}</td><td>{gameSummary.Away.system}</td></tr>
                          <tr>
                            <td>Shot Margin</td>
                            <td>{gameSummary.Home.shots - gameSummary.Away.shots > 0 ? `+${gameSummary.Home.shots - gameSummary.Away.shots}` : gameSummary.Home.shots - gameSummary.Away.shots}</td>
                            <td>{gameSummary.Away.shots - gameSummary.Home.shots > 0 ? `+${gameSummary.Away.shots - gameSummary.Home.shots}` : gameSummary.Away.shots - gameSummary.Home.shots}</td>
                          </tr>
                          <tr><td>Shot Quality</td><td>{(gameSummary.Home.sQual / (gameSummary.Home.shots || 1)).toFixed(3)}</td><td>{(gameSummary.Away.sQual / (gameSummary.Away.shots || 1)).toFixed(3)}</td></tr>
                          <tr><td>Result Quality</td><td>{(gameSummary.Home.system / (gameSummary.Home.poss || 1)).toFixed(3)}</td><td>{(gameSummary.Away.system / (gameSummary.Away.poss || 1)).toFixed(3)}</td></tr>
                          <tr style={{ backgroundColor: '#2c3e50', color: 'white', fontWeight: 'bold', textAlign: 'center' }}><td colSpan="3">Possession Breakdown</td></tr>
                          <tr><td>Possessions</td><td>{gameSummary.Home.poss}</td><td>{gameSummary.Away.poss}</td></tr>
                          {['s6', 's4', 's7_11', 's3', 's1', 's0'].map(k => (
                            <tr key={k}><td>{k === 's7_11' ? '7%/11%' : `${k.slice(1)}%`}</td><td>{gameSummary.Home.breakdown[k]}</td><td>{gameSummary.Away.breakdown[k]}</td></tr>
                          ))}
                          <tr style={{ backgroundColor: '#2c3e50', color: 'white', fontWeight: 'bold', textAlign: 'center' }}><td colSpan="3">Execution</td></tr>
                          <tr><td>Real Score</td><td style={{ fontWeight: 'bold' }}>{gameSummary.Home.score}</td><td style={{ fontWeight: 'bold' }}>{gameSummary.Away.score}</td></tr>
                          <tr><td>PPP</td><td>{gameSummary.Home.execution.ppp}</td><td>{gameSummary.Away.execution.ppp}</td></tr>
                          <tr><td>PPS</td><td>{gameSummary.Home.execution.pps}</td><td>{gameSummary.Away.execution.pps}</td></tr>
                          {['e6', 'e4', 'e7_11', 'e3', 'e1', 'e0'].map(k => (
                            <tr key={k}><td>{k === 'e7_11' ? '7/11 Exec.' : `${k.slice(1)} Exec.`}</td><td>{gameSummary.Home.execution[k]}</td><td>{gameSummary.Away.execution[k]}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p style={{ color: '#888', fontStyle: 'italic' }}>Select a game above to view analytical data distributions.</p>
            )}
          </section>
        )}
        
        {/* ========================================================= */}
        {/* MAINTAINED TEAM PERFORMANCE TAB                            */}
        {/* ========================================================= */}
        {activeTab === 'Team' && (
          <section>
            <select onChange={(e) => fetchTeamStats(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
              <option value="">Select a Team</option>
              {allTeams.map(team => <option key={team} value={team}>{team}</option>)}
            </select>
            
            {selectedTeamStats && (() => {
              const { frame, accent } = getTeamFrameColors(selectedTeamStats.teamName);
              return (
              <div style={{
                marginTop: '20px',
                background: frame,
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxSizing: 'border-box',   // ADD THIS
                width: '100%'
              }}>
              
                <TeamProfileDashboard teamData={selectedTeamStats} systemRecord={selectedTeamStats.sysRecord || "0-0"} accentColor={accent} />
                <div style={{ width: '100%', maxWidth: '850px', margin: '0 auto', backgroundColor: 'white', borderRadius: '8px', border: `4px solid ${accent}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)', padding: '20px 24px', boxSizing: 'border-box' }}>
                  <ShotDistributionCharts shotDistribution={selectedTeamStats.shotDistribution} shotPpsLog={selectedTeamStats.shotPpsLog} leagueAvgDist={leagueAvgDist} teamName={selectedTeamStats.teamName} />
                </div>
                {/*<div style={{ marginTop: '20px', textAlign: 'left' }}>
                  <h3 style = {{textAlign: 'center'}}>{selectedTeamStats.teamName} ({selectedTeamStats.record})</h3>
                  <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th>Side</th><th>System Score</th><th>Shot Margin</th><th>Possessions</th><th>Shots Gained/100</th><th>Result Quality</th><th>Shot Quality</th><th>Stint Quality</th><th>OREB%</th><th>FT REB</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: ' 1px solid #2c3e50' }}>Offense</td>
                        <td>{selectedTeamStats.off.sysG}</td><td rowSpan="2">{selectedTeamStats.shot_margin}</td><td>{selectedTeamStats.off.possG}</td><td>{selectedTeamStats.shotsGained100}</td><td>{selectedTeamStats.off.result_q}</td><td>{selectedTeamStats.off.shot_q}</td><td>{selectedTeamStats.off.stint_q}</td><td>{selectedTeamStats.off.oRebPct}</td><td>{selectedTeamStats.off.ftRebG}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #2c3e50' }}>Defense</td>
                        <td>{selectedTeamStats.def.sysG}</td><td>{selectedTeamStats.def.possG}</td><td>{selectedTeamStats.shotsGained100d}</td><td>{selectedTeamStats.def.result_q}</td><td>{selectedTeamStats.def.shot_q}</td><td>{selectedTeamStats.def.stint_q}</td><td>{selectedTeamStats.def.oRebPct}</td><td>{selectedTeamStats.def.ftRebG}</td>
                      </tr>
                    </tbody>
                  </table>
                </div> */}

                {/*<ShotTypeBoxPlot shotPpsLog={selectedTeamStats.shotPpsLog} shotDistribution={selectedTeamStats.shotDistribution} /> */}

                {/*<div style={{ marginTop: '40px', textAlign: 'left' }}>
                  <h3 style={{ marginBottom: '20px' }}>Team Shot Type Breakdown</h3>
                  <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th></th><th colSpan="2">6's (Exp. PPS: 1.50)</th><th colSpan="2">4's (Exp. PPS: 1.00)</th><th colSpan="2">7's (Exp. PPS: 1.75)</th><th colSpan="2">3's (Exp. PPS: 0.75)</th><th colSpan="2">1's (Exp. PPS: 0.25)</th><th colSpan="2">0's (Exp. PPS: 0.00)</th>
                      </tr>
                      <tr style={{ backgroundColor: '#ecf0f1', color: '#2c3e50' }}>
                        <th style={{ fontWeight: 'bold' }}>Side</th>
                        {[...Array(6)].map((_, i) => (
                          <React.Fragment key={i}><th>% of Shots</th><th>Actual PPS</th></React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>Offense</td>
                        {selectedTeamStats.shotDistribution.offense.map((item, idx) => (
                          <React.Fragment key={idx}><td>{item.pct}</td><td style={{ fontWeight: '500' }}>{item.pps}</td></React.Fragment>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>Defense</td>
                        {selectedTeamStats.shotDistribution.defense.map((item, idx) => (
                          <React.Fragment key={idx}><td>{item.pct}</td><td style={{ fontWeight: '500' }}>{item.pps}</td></React.Fragment>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div> */}

                <div style={{
                  width: '100%',
                  maxWidth: '100%',
                  margin: '0 auto',
                  textAlign: 'left',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: `4px solid ${accent}`,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  padding: '5px 5px',
                  boxSizing: 'border-box'
                }}>
                  <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>Schedule</h3>

                  {/* scrolling isolated to just the table */}
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <style>{`
                      .schedule-table th, .schedule-table td { padding: 3px 4px; }
                      .schedule-table thead th { line-height: 1.2; white-space: pre-line; }
                    `}</style>
                    <table className="play-table schedule-table" style={{ fontSize: '0.65rem', width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <colgroup>
                        <col style={{ width: '48px' }} />
                        <col style={{ width: '85px' }} />
                        <col style={{ width: '48px' }} />
                        <col style={{ width: '48px' }} />
                        <col style={{ width: '42px' }} />
                        <col style={{ width: '48px' }} />
                        {[...Array(8)].map((_, i) => <col key={`off-${i}`} style={{ width: '35px' }} />)}
                        {[...Array(8)].map((_, i) => <col key={`def-${i}`} style={{ width: '35px' }} />)}
                      </colgroup>
                      <thead>
                        <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                          <th colSpan="6" style={{ fontSize: '1.0rem' }}>Game Summary</th>
                          <th colSpan="8" style={{ backgroundColor: '#16a085', fontSize: '1.0rem' }}>Offensive Breakdown</th>
                          <th colSpan="8" style={{ backgroundColor: '#2980b9', fontSize: '1.0rem' }}>Defensive Breakdown</th>
                        </tr>
                        <tr style={{ backgroundColor: '#ecf0f1', color: '#2c3e50', fontWeight: 'bold' }}>
                          <th>Date</th><th>Opp.</th><th>{"Game\nResult"}</th><th>{"System\nResult"}</th><th>{"Shot\nMargin"}</th><th>Poss.</th>
                          {['SQ Off', 'RQ Off', '6% Off', '4% Off', '3% Off', '1% Off', '7/11% Off', '0% Off'].map(h => <th key={h} style={{ backgroundColor: '#e8f8f5' }}>{h.replace(' ', '\n')}</th>)}
                          {['SQ Def', 'RQ Def', '6% Def', '4% Def', '3% Def', '1% Def', '7/11% Def', '0% Def'].map(h => <th key={h} style={{ backgroundColor: '#eaf2f8' }}>{h.replace(' ', '\n')}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeamStats.schedule && selectedTeamStats.schedule.map((game, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                            <td>{new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td style={{ textAlign: 'center', fontWeight: '500' }}>{game.opponent}</td>
                            <td style={{ fontWeight: 'bold', color: game.gameResult.startsWith('W') ? 'green' : 'red' }}>{game.gameResult}</td>
                            <td style={{ color: game.systemResult.startsWith('W') ? 'green' : 'red' }}>{game.systemResult}</td>
                            <td style={{ fontWeight: '500', color: game.shotMargin.startsWith('+') ? 'green' : 'red' }}>{game.shotMargin}</td><td>{game.possSummary}</td>
                            <td style={{ backgroundColor: '#f4fbf9', fontWeight: '500', fontSize: '0.65rem' }}>{game.sqOff}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem' }}>{game.rqOff}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem' }}>{game.off6}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem'}}>{game.off4}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem' }}>{game.off3}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem' }}>{game.off1}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem' }}>{game.off7_11}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.65rem' }}>{game.off0}</td>
                            <td style={{ backgroundColor: '#f5f9fc', fontWeight: '500', fontSize: '0.65rem' }}>{game.sqDef}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.rqDef}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.def6}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.def4}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.def3}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.def1}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.def7_11}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.65rem' }}>{game.def0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              );
            })()}
          </section>
        )}

        {/* ========================================================= */}
        {/* MAINTAINED LEAGUE SUMMARY TAB                              */}
        {/* ========================================================= */}
        {activeTab === 'League' && (
          <section style={{ animation: 'fadeIn 0.4s ease-in-out' }}>
            <div style={{ textAlign: 'left', marginBottom: '25px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>League Statistical Leaderboards</h2>
              <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '0.9rem' }}>Compare analytical performance matrices, execution efficiency rates, and possession shot breakdowns across all conference teams.</p>
            </div>

            {leagueLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', fontStyle: 'italic', color: '#888' }}>Processing data statistics across database files...</div>
            ) : (
              <div>
                <h3 style={{ textAlign: 'center', color: '#2c3e50', margin: '20px 0 10px 0' }}>🏀 Team Offensive Performance Summary</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="offense.sysG" columns={[{ key: 'teamName', label: 'Team Name', sortable: true, minWidth: '110px' }, { key: 'record', label: 'Record', sortable: true }, { key: 'systemRecord', label: 'System Record', sortable: true }, { key: 'offense.sysG', label: 'System Score', decimals: 1 }, { key: 'offense.shotMargin', label: 'Shot Margin', sortable: true }, { key: 'offense.possG', label: 'Poss/G', decimals: 1 }, { key: 'offense.shotsGained', label: 'Shots Gained/100', decimals: 2 }, { key: 'offense.result_q', label: 'Result Quality', decimals: 2 }, { key: 'offense.shot_q', label: 'Shot Quality', decimals: 2 }, { key: 'offense.stint_q', label: 'Stint Quality', decimals: 2 }, { key: 'offense.oRebPct', label: 'OREB%', sortable: true }, { key: 'offense.ftRebG', label: 'FT REB', decimals: 1 }]} />

                <h3 style={{ textAlign: 'center', color: '#c0392b', margin: '30px 0 10px 0' }}>🛡️ Team Defensive Performance Summary</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="defense.sysG" columns={[{ key: 'teamName', label: 'Team Name', sortable: true, minWidth: '110px' }, { key: 'record', label: 'Record', sortable: true }, { key: 'systemRecord', label: 'System Record', sortable: true }, { key: 'defense.sysG', label: 'System Score', decimals: 1 }, { key: 'defense.shotMargin', label: 'Shot Margin', sortable: true }, { key: 'defense.possG', label: 'Poss/G', decimals: 1 }, { key: 'defense.shotsGained', label: 'Shots Gained/100', decimals: 2 }, { key: 'defense.result_q', label: 'Result Quality', decimals: 2 }, { key: 'defense.shot_q', label: 'Shot Quality', decimals: 2 }, { key: 'defense.stint_q', label: 'Stint Quality', decimals: 2 }, { key: 'defense.oRebPct', label: 'OREB%', sortable: true }, { key: 'defense.ftRebG', label: 'FT REB', decimals: 1 }]} />

                <h3 style={{ textAlign: 'center', color: '#2c3e50', margin: '30px 0 10px 0' }}>📊 Shot Distribution & Execution Breakdown (Offense)</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="offense.distribution.0.pct" columns={[{ key: 'teamName', label: 'Team Name', sortable: true, minWidth: '110px' }, { key: 'offense.distribution.0.pct', label: "% of Shots (6's)" }, { key: 'offense.distribution.0.pps', label: "Actual PPS (6's)" }, { key: 'offense.distribution.1.pct', label: "% of Shots (4's)" }, { key: 'offense.distribution.1.pps', label: "Actual PPS (4's)" }, { key: 'offense.distribution.2.pct', label: "% of Shots (7's)" }, { key: 'offense.distribution.2.pps', label: "Actual PPS (7's)" }, { key: 'offense.distribution.3.pct', label: "% of Shots (3's)" }, { key: 'offense.distribution.3.pps', label: "Actual PPS (3's)" }, { key: 'offense.distribution.4.pct', label: "% of Shots (1's)" }, { key: 'offense.distribution.4.pps', label: "Actual PPS (1's)" }, { key: 'offense.distribution.5.pct', label: "% of Shots (0's)" }, { key: 'offense.distribution.5.pps', label: "Actual PPS (0's)" }]} />

                <h3 style={{ textAlign: 'center', color: '#c0392b', margin: '30px 0 10px 0' }}>🎯 Shot Distribution & Execution Breakdown (Defense)</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="defense.distribution.0.pct" columns={[{ key: 'teamName', label: 'Team Name', sortable: true, minWidth: '110px' }, { key: 'defense.distribution.0.pct', label: "% of Shots (6's)" }, { key: 'defense.distribution.0.pps', label: "Actual PPS (6's)" }, { key: 'defense.distribution.1.pct', label: "% of Shots (4's)" }, { key: 'defense.distribution.1.pps', label: "Actual PPS (4's)" }, { key: 'defense.distribution.2.pct', label: "% of Shots (7's)" }, { key: 'defense.distribution.2.pps', label: "Actual PPS (7's)" }, { key: 'defense.distribution.3.pct', label: "% of Shots (3's)" }, { key: 'defense.distribution.3.pps', label: "Actual PPS (3's)" }, { key: 'defense.distribution.4.pct', label: "% of Shots (1's)" }, { key: 'defense.distribution.4.pps', label: "Actual PPS (1's)" }, { key: 'defense.distribution.5.pct', label: "% of Shots (0's)" }, { key: 'defense.distribution.5.pps', label: "Actual PPS (0's)" }]} />
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* MAINTAINED SYSTEM VERIFICATION TAB                        */}
        {/* ========================================================= */}
        {activeTab === 'System' && systemStats && (
          <section className="systems-tab-container" style={{ maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <h1 style={{fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)'}}>Shot Quality Scoring System</h1>
            <h2 style={{marginBottom: '24px', fontSize: 'clamp(0.85rem, 3vw, 1.0rem)', fontFamily: 'system-ui, -apple-system, sans-serif'}}>A Contextual Expected Value Framework for Comprehensive Basketball Evaluation and Decision-Making</h2>
            {/*<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>*/}

            <div style={{ backgroundColor: '#2c3e50', color: '#fff', padding: '30px 20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', textAlign: 'center', borderBottom: '6px solid #2980b9' }}>
              <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#bdc3c7', fontWeight: 'bold' }}>
                Overall Accuracy
              </span>
              <h2 style={{ fontSize: '2.8rem', margin: '6px 0', color: '#fff', fontWeight: '700', lineHeight: '1' }}>
                {systemStats.standard.pct}% ({systemStats.standard.count}/{systemStats.total})
              </h2>
              <h3 style={{ fontSize: '1.0rem', margin: '6px 0', color: '#fff', fontWeight: '800', lineHeight: '1' }}>
                Projected Record: {Math.round((systemStats.standard.count / systemStats.total) * 28)}-{28-Math.round((systemStats.standard.count / systemStats.total) * 28)}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#ecf0f1', opacity: 0.95 }}>
                *Accuracy of game outcomes picked by System Score.
              </p>
              {/*<div>
                <p style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0' }}>Overall Accuracy: {systemStats.standard.pct}% ({systemStats.standard.count}/{systemStats.total})</p>
                <p style={{ fontSize: '1.2rem', margin: '5px 0 0 0', color: '#666' }}>Projected Record: {systemStats.standard.count}-{systemStats.total - systemStats.standard.count}</p>
              </div>
              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: '600', margin: '0' }}>Conservative Accuracy: {systemStats.conservative.pct}% ({systemStats.conservative.count}/{systemStats.total})</p>
                <p style={{ fontSize: '1.0rem', margin: '2px 0 0 0', color: '#666' }}>Projected Record: {systemStats.conservative.count}-{systemStats.total - systemStats.conservative.count}</p>
              </div>
              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: '600', margin: '0' }}>Aggressive Accuracy: {systemStats.aggressive.pct}% ({systemStats.aggressive.count}/{systemStats.total})</p>
                <p style={{ fontSize: '1.0rem', margin: '2px 0 0 0', color: '#666' }}>Projected Record: {systemStats.aggressive.count}-{systemStats.total - systemStats.aggressive.count}</p>
              </div>*/}
            </div>
            {/* Conservative Baseline Card */}
            <div style={{ backgroundColor: '#fff', padding: '10px 5px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', textAlign: 'center', border: '1px solid #e2e8f0', borderBottom: '6px solid #16a085' }}>
              <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#7f8c8d', fontWeight: 'bold' }}>
                Conservative Baseline
              </span>
              <h2 style={{ fontSize: '2.8rem', margin: '6px 0', color: '#16a085', fontWeight: '700', lineHeight: '1' }}>
                {systemStats.conservative.pct}% ({systemStats.conservative.count}/{systemStats.total})
              </h2>
              <h3 style={{ fontSize: '1.0rem', margin: '6px 0', color: '#16a085', fontWeight: '800', lineHeight: '1' }}>
                Projected Record: {Math.floor((systemStats.conservative.count / systemStats.total) * 28)}-{28-Math.floor((systemStats.conservative.count / systemStats.total) * 28)}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f8c8d' }}>
                *Accuracy if all games within 5 System Score points were counted as System losses.
              </p>
            </div>

            {/* Aggressive Threshold Card */}
            <div style={{ backgroundColor: '#fff', padding: '10px 5px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', textAlign: 'center', border: '1px solid #e2e8f0', borderBottom: '6px solid #e67e22' }}>
              <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#7f8c8d', fontWeight: 'bold' }}>
                Aggressive Threshold
              </span>
              <h2 style={{ fontSize: '2.8rem', margin: '6px 0', color: '#e67e22', fontWeight: '700', lineHeight: '1' }}>
                {systemStats.aggressive.pct}% ({systemStats.aggressive.count}/{systemStats.total})
              </h2>
              <h3 style={{ fontSize: '1.0rem', margin: '6px 0', color: '#e67e22', fontWeight: '800', lineHeight: '1' }}>
                Projected Record: {Math.round((systemStats.aggressive.count / systemStats.total) * 28)}-{28-Math.round((systemStats.aggressive.count / systemStats.total) * 28)}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f8c8d' }}>
                *Accuracy if all games within 5 System Score points were counted as System wins.
              </p>
            </div>

            {/* SECTION HEADER BLOCK */}
            <div style={{ paddingTop: '45px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0', marginBottom: '30px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.6rem', fontWeight: '700' }}>
                Model Validation
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#7f8c8d', fontSize: '0.95rem' }}>
                Analyzing historical predictive thresholds alongside live structural scoring environments.
              </p>
            </div>

            <div style={{ marginBottom: '25px' }}>{systemStats?.rawDifferentials && <SystemDifferentialChart rawData={systemStats.rawDifferentials} />}</div>

            {/* ITEM 3: SCORING ENVIRONMENT TABLE (Clean, focused layout) */}
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '24px', 
              borderRadius: '12px', 
              boxShadow: '0 4px 10px rgba(0,0,0,0.02)', 
              border: '1px solid #e2e8f0', 
              marginBottom: '45px' 
            }}>
              <div style={{ marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.25rem', fontWeight: '600' }}>
                  Scoring Environment
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#7f8c8d' }}>
                  Examining the accuracy of the seven different shot quality 'buckets'
                </p>
              </div>
              {/*<h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Scoring Environment</h2>*/}
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2c3e50', color: 'white', border: '1px solid #2c3e50' }}>
                      <th>Shot Type</th><th>Actual PPS</th><th>Expected PPS</th><th>PPS Difference</th><th>Shot Variation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemStats.shotTable.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #2c3e50' }}>{row.type}</td><td style={{border: '1px solid #2c3e50'}}>{row.actual}</td><td style={{border: '1px solid #2c3e50'}}>{row.expected}</td>
                        <td style={{ color: parseFloat(row.diff) >= 0 ? 'green' : 'red', border: '1px solid #2c3e50' }}>{parseFloat(row.diff) > 0 ? `+${row.diff}` : row.diff}</td><td style={{border: '1px solid #2c3e50'}}>{row.rsd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            
            {/* SCATTER PLOT INJECTED HERE AT THE TOP OF THE SYSTEM VIEW */}
            <TeamPerformanceScatterPlot systemData={systemStats.teamTable} />
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#2c3e50' }}>
              Team Performance vs. System Breakdown
            </h2>
            <TeamStatStrip teamTable={systemStats.teamTable} />
            
            <TeamPerformanceCards teamTable={systemStats.teamTable} />

            {/*<TeamLollipopChart teamTable={systemStats.teamTable} />*/}
            
            {/*<div style={{ marginTop: '40px', width: '100%', textAlign: 'left' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Team Performance vs. System</h2>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                      <th>Team</th><th>Record</th><th>System Record</th><th>GB</th><th>Matched</th><th>Mismatched</th><th>Exp. PPS</th><th>Act. PPS</th><th>PPS Diff</th><th>Exp. PPP</th><th>Act. PPP</th><th>PPP Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemStats.teamTable.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>{row.name}</td><td>{row.record}</td><td>{row.sysRecord}</td>
                        <td style={{ color: row.gb > 0 ? 'green' : row.gb < 0 ? 'red' : 'inherit' }}>{row.gb > 0 ? `+${row.gb}` : row.gb}</td><td>{row.matched}</td><td>{row.mismatched}</td><td>{row.expectedPPS}</td><td>{row.actualPPS}</td>
                        <td style={{ color: parseFloat(row.ppsDiff) >= 0 ? 'green' : 'red' }}>{parseFloat(row.ppsDiff) > 0 ? `+${row.ppsDiff}` : row.ppsDiff}</td><td>{row.expectedPPP}</td><td>{row.actualPPP}</td>
                        <td style={{ color: parseFloat(row.pppDiff) >= 0 ? 'green' : 'red' }}>{parseFloat(row.pppDiff) > 0 ? `+${row.pppDiff}` : row.pppDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div> */}
            
            
            <hr style={{ margin: '40px auto 20px auto', width: '90%', border: '0', borderTop: '1px solid #ddd' }} />
            <p style={{ margin: 20, fontSize: '1.2rem', color: '#666' }}>Behind the dashboard is a complete analytical framework — explore the full research, methodology, and findings below.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '40px' }}>
              <a href="/manuals/MEC_Shot_Quality_Study.pdf#page=1" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', backgroundColor: '#16a085', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                📄 System Scoring Study Write-Up (PDF)
              </a>
              <a href="/manuals/Shot_Quality_Scoring_System_Presentation.pdf#page=1" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', backgroundColor: '#2980b9', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
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