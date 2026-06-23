import React, { useState, useEffect, useMemo } from 'react';
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
  Cell
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
        "Win Probability": b.totalCount > 0 ? Math.round((b.correctCount / b.totalCount) * 100) : 0,
        "Game Count": b.totalCount
      }))
      .filter(b => b["Game Count"] > 0);
  }, [rawData, binSize]);

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

  return (
    <div className="coach-card executive-matchup-grid" style={{ marginBottom: '25px' }}>
      {/* LEFT COLUMN: HOME TEAM */}
      <div className="team-column">
        <div className="team-logo-container">
          <img 
            src={homeLogoSrc} 
            alt={`${homeTeam} Logo`} 
            className="dashboard-team-logo"
            onError={handleImageError}
          />
        </div>
        <h2 className="team-name">{homeTeam}</h2>
        <div className="metric-value massive-text">{homeScore} <span className="small-subtext">({homePPP} PPP)</span></div>
        <div className="metric-value large-text text-accent">{homeSystemScore} <span className="small-subtext">({homeRQ} RQ)</span></div>
        <div className="metric-value normal-text">{homePoss}</div>
        <div className="metric-gap"></div>
        <div className="metric-value normal-text font-bold">{homeSQ}</div>
        <div className="metric-value normal-text">{homeShotMargin > 0 ? `+${homeShotMargin}` : homeShotMargin}</div>
        <div className="metric-value large-text text-win-prob">{winProbability}%</div>
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
      <div className="team-column">
        <div className="team-logo-container">
          <img 
            src={awayLogoSrc} 
            alt={`${awayTeam} Logo`} 
            className="dashboard-team-logo"
            onError={handleImageError}
          />
        </div>
        <h2 className="team-name">{awayTeam}</h2>
        <div className="metric-value massive-text">{awayScore} <span className="small-subtext">({awayPPP} PPP)</span></div>
        <div className="metric-value large-text text-accent">{awaySystemScore} <span className="small-subtext">({awayRQ} RQ)</span></div>
        <div className="metric-value normal-text">{awayPoss}</div>
        <div className="metric-gap"></div>
        <div className="metric-value normal-text font-bold">{awaySQ}</div>
        <div className="metric-value normal-text">{awayShotMargin > 0 ? `+${awayShotMargin}` : awayShotMargin}</div>
        <div className="metric-value large-text text-win-prob">{(100 - winProbability)}%</div>
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
    { name: "6's", value: parsePercent(home.breakdown?.s6), color: '#2ecc71'},
    { name: "4's", value: parsePercent(home.breakdown?.s4), color: '#16a085' },
    { name: "7's/11's", value: parsePercent(home.breakdown?.s7_11), color: '#f1c40f' },
    { name: "3's", value: parsePercent(home.breakdown?.s3), color: '#e67e22' },
    { name: "1's", value: parsePercent(home.breakdown?.s1), color: '#e74c3c' },
    { name: "0's", value: parsePercent(home.breakdown?.s0), color: '#000000' }
  ].filter(d => d.value > 0);

  const awayPieData = [
    { name: "6's", value: parsePercent(away.breakdown?.s6), color: '#2ecc71' },
    { name: "4's", value: parsePercent(away.breakdown?.s4), color:  '#16a085'},
    { name: "7's/11's", value: parsePercent(away.breakdown?.s7_11), color: '#f1c40f' },
    { name: "3's", value: parsePercent(away.breakdown?.s3), color: '#e67e22' },
    { name: "1's", value: parsePercent(away.breakdown?.s1), color: '#e74c3c' },
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
          {[['6\'s', '#2ecc71'], ['4\'s', '#16a085'], ['7/11\'s', '#f1c40f'], ['3\'s', '#e67e22'], ['1\'s', '#e74c3c'], ['0\'s', '#000000']].map(tag => (
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
  "Salem": {"primary": "#149348", "secondary": "#FFFFFF"}
};
const DEFAULT_HOME_COLOR = "#16a085";
const DEFAULT_AWAY_COLOR = "#2980b9";

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
    if (activeTab === 'System' && !systemStats) {
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
          <section style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
            
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
              
              {plays.length > 0 && (
                <button 
                  onClick={() => setViewMode(viewMode === 'coach' ? 'classic' : 'coach')}
                  style={{ padding: '8px 16px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  {viewMode === 'coach' ? '📋 Switch to Classic Tables' : '📊 Switch to Coach Charts'}
                </button>
              )}
            </div>

            {plays.length > 0 ? (
              viewMode === 'coach' ? (
                /* NEW INTERACTIVE VIEW HOOKS */
                <div className="coach-dashboard-layout" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  
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
            
            {selectedTeamStats && (
              <>
                <div style={{ marginTop: '20px', textAlign: 'left' }}>
                  <h3>{selectedTeamStats.teamName} ({selectedTeamStats.record})</h3>
                  <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th>Side</th><th>System Score</th><th>Shot Margin</th><th>Possessions</th><th>Shots Gained/100</th><th>Result Quality</th><th>Shot Quality</th><th>Stint Quality</th><th>OREB%</th><th>FT REB</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>Offense</td>
                        <td>{selectedTeamStats.off.sysG}</td><td rowSpan="2">{selectedTeamStats.shot_margin}</td><td>{selectedTeamStats.off.possG}</td><td>{selectedTeamStats.shotsGained100}</td><td>{selectedTeamStats.off.result_q}</td><td>{selectedTeamStats.off.shot_q}</td><td>{selectedTeamStats.off.stint_q}</td><td>{selectedTeamStats.off.oRebPct}</td><td>{selectedTeamStats.off.ftRebG}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>Defense</td>
                        <td>{selectedTeamStats.def.sysG}</td><td>{selectedTeamStats.def.possG}</td><td>{selectedTeamStats.shotsGained100d}</td><td>{selectedTeamStats.def.result_q}</td><td>{selectedTeamStats.def.shot_q}</td><td>{selectedTeamStats.def.stint_q}</td><td>{selectedTeamStats.def.oRebPct}</td><td>{selectedTeamStats.def.ftRebG}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'left' }}>
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
                </div>

                <div style={{ marginTop: '40px', width: '100%', overflowX: 'auto', textAlign: 'left' }}>
                  <h3 style={{ marginBottom: '15px' }}>Schedule</h3>
                  <table className="play-table" style={{ fontSize: '0.74rem', width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                        <th colSpan="6" style={{ fontSize: '0.9rem' }}>Game Summary</th>
                        <th colSpan="8" style={{ backgroundColor: '#16a085', fontSize: '0.9rem' }}>Offensive Breakdown</th>
                        <th colSpan="8" style={{ backgroundColor: '#2980b9', fontSize: '0.9rem' }}>Defensive Breakdown</th>
                      </tr>
                      <tr style={{ backgroundColor: '#ecf0f1', color: '#2c3e50', fontWeight: 'bold' }}>
                        <th>Date</th><th>Opp.</th><th>Game Result</th><th>System Result</th><th>Shot Margin</th><th>Poss.</th>
                        {['SQ Off', 'RQ Off', '6% Off', '4% Off', '3% Off', '1% Off', '7/11% Off', '0% Off'].map(h => <th key={h} style={{ backgroundColor: '#e8f8f5' }}>{h}</th>)}
                        {['SQ Def', 'RQ Def', '6% Def', '4% Def', '3% Def', '1% Def', '7/11% Def', '0% Def'].map(h => <th key={h} style={{ backgroundColor: '#eaf2f8' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeamStats.schedule && selectedTeamStats.schedule.map((game, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td>{game.date}</td><td style={{ textAlign: 'left', fontWeight: '500' }}>{game.opponent}</td>
                          <td style={{ fontWeight: 'bold', color: game.gameResult.startsWith('W') ? 'green' : 'red' }}>{game.gameResult}</td>
                          <td style={{ color: game.systemResult.startsWith('W') ? 'green' : 'red' }}>{game.systemResult}</td>
                          <td style={{ fontWeight: '500', color: game.shotMargin.startsWith('+') ? 'green' : 'inherit' }}>{game.shotMargin}</td><td>{game.possSummary}</td>
                          <td style={{ backgroundColor: '#f4fbf9', fontWeight: '500' }}>{game.sqOff}</td><td style={{ backgroundColor: '#f4fbf9' }}>{game.rqOff}</td><td style={{ backgroundColor: '#f4fbf9' }}>{game.off6}</td><td style={{ backgroundColor: '#f4fbf9' }}>{game.off4}</td><td style={{ backgroundColor: '#f4fbf9' }}>{game.off3}</td><td style={{ backgroundColor: '#f4fbf9' }}>{game.off1}</td><td style={{ backgroundColor: '#f4fbf9', fontSize: '0.5rem' }}>{game.off7_11}</td><td style={{ backgroundColor: '#f4fbf9', color: '#c0392b' }}>{game.off0}</td>
                          <td style={{ backgroundColor: '#f5f9fc', fontWeight: '500' }}>{game.sqDef}</td><td style={{ backgroundColor: '#f5f9fc' }}>{game.rqDef}</td><td style={{ backgroundColor: '#f5f9fc' }}>{game.def6}</td><td style={{ backgroundColor: '#f5f9fc' }}>{game.def4}</td><td style={{ backgroundColor: '#f5f9fc' }}>{game.def3}</td><td style={{ backgroundColor: '#f5f9fc' }}>{game.def1}</td><td style={{ backgroundColor: '#f5f9fc', fontSize: '0.5rem' }}>{game.def7_11}</td><td style={{ backgroundColor: '#f5f9fc', color: '#c0392b' }}>{game.def0}</td>
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
                <h3 style={{ textAlign: 'left', color: '#2c3e50', margin: '20px 0 10px 0' }}>🏀 Team Offensive Performance Summary</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="offense.result_q" columns={[{ key: 'teamName', label: 'Team Name', sortable: true }, { key: 'record', label: 'Record', sortable: true }, { key: 'systemRecord', label: 'System Record', sortable: true }, { key: 'offense.sysG', label: 'System Score', decimals: 2 }, { key: 'offense.shotMargin', label: 'Shot Margin', sortable: true }, { key: 'offense.possG', label: 'Possessions', decimals: 1 }, { key: 'offense.shotsGained', label: 'Shots Gained/100', decimals: 1 }, { key: 'offense.result_q', label: 'Result Quality', decimals: 3 }, { key: 'offense.shot_q', label: 'Shot Quality', decimals: 3 }, { key: 'offense.stint_q', label: 'Stint Quality', decimals: 3 }, { key: 'offense.oRebPct', label: 'OREB%', sortable: true }, { key: 'offense.ftRebG', label: 'FT REB', decimals: 2 }]} />

                <h3 style={{ textAlign: 'left', color: '#c0392b', margin: '30px 0 10px 0' }}>🛡️ Team Defensive Performance Summary</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="defense.result_q" columns={[{ key: 'teamName', label: 'Team Name', sortable: true }, { key: 'record', label: 'Record', sortable: true }, { key: 'systemRecord', label: 'System Record', sortable: true }, { key: 'defense.sysG', label: 'System Score', decimals: 2 }, { key: 'defense.shotMargin', label: 'Shot Margin', sortable: true }, { key: 'defense.possG', label: 'Possessions', decimals: 1 }, { key: 'defense.shotsGained', label: 'Shots Gained/100', decimals: 1 }, { key: 'defense.result_q', label: 'Result Quality', decimals: 3 }, { key: 'defense.shot_q', label: 'Shot Quality', decimals: 3 }, { key: 'defense.stint_q', label: 'Stint Quality', decimals: 3 }, { key: 'defense.oRebPct', label: 'OREB%', sortable: true }, { key: 'defense.ftRebG', label: 'FT REB', decimals: 2 }]} />

                <h3 style={{ textAlign: 'left', color: '#2c3e50', margin: '30px 0 10px 0' }}>📊 Shot Distribution & Execution Breakdown (Offense)</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="teamName" columns={[{ key: 'teamName', label: 'Team Name', sortable: true }, { key: 'offense.distribution.0.pct', label: "% of Shots (6's)" }, { key: 'offense.distribution.0.pps', label: "Actual PPS (6's)" }, { key: 'offense.distribution.1.pct', label: "% of Shots (4's)" }, { key: 'offense.distribution.1.pps', label: "Actual PPS (4's)" }, { key: 'offense.distribution.2.pct', label: "% of Shots (7's)" }, { key: 'offense.distribution.2.pps', label: "Actual PPS (7's)" }, { key: 'offense.distribution.3.pct', label: "% of Shots (3's)" }, { key: 'offense.distribution.3.pps', label: "Actual PPS (3's)" }, { key: 'offense.distribution.4.pct', label: "% of Shots (1's)" }, { key: 'offense.distribution.4.pps', label: "Actual PPS (1's)" }, { key: 'offense.distribution.5.pct', label: "% of Shots (0's)" }, { key: 'offense.distribution.5.pps', label: "Actual PPS (0's)" }]} />

                <h3 style={{ textAlign: 'left', color: '#c0392b', margin: '30px 0 10px 0' }}>🎯 Shot Distribution & Execution Breakdown (Defense)</h3>
                <SortableLeagueTable data={leagueSummary} initialSortKey="teamName" columns={[{ key: 'teamName', label: 'Team Name', sortable: true }, { key: 'defense.distribution.0.pct', label: "% of Shots (6's)" }, { key: 'defense.distribution.0.pps', label: "Actual PPS (6's)" }, { key: 'defense.distribution.1.pct', label: "% of Shots (4's)" }, { key: 'defense.distribution.1.pps', label: "Actual PPS (4's)" }, { key: 'defense.distribution.2.pct', label: "% of Shots (7's)" }, { key: 'defense.distribution.2.pps', label: "Actual PPS (7's)" }, { key: 'defense.distribution.3.pct', label: "% of Shots (3's)" }, { key: 'defense.distribution.3.pps', label: "Actual PPS (3's)" }, { key: 'defense.distribution.4.pct', label: "% of Shots (1's)" }, { key: 'defense.distribution.4.pps', label: "Actual PPS (1's)" }, { key: 'defense.distribution.5.pct', label: "% of Shots (0's)" }, { key: 'defense.distribution.5.pps', label: "Actual PPS (0's)" }]} />
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* MAINTAINED SYSTEM VERIFICATION TAB                        */}
        {/* ========================================================= */}
        {activeTab === 'System' && systemStats && (
          <section style={{ textAlign: 'center', marginTop: '40px' }}>
            <h1 style={{ marginBottom: '30px' }}>Scoring System Results</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
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
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '30px', textAlign: 'left' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Scoring Environment</h2>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="play-table" style={{ fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                      <th>Shot Type</th><th>Actual PPS</th><th>Expected PPS</th><th>PPS Difference</th><th>Shot Variation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemStats.shotTable.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>{row.type}</td><td>{row.actual}</td><td>{row.expected}</td>
                        <td style={{ color: parseFloat(row.diff) >= 0 ? 'green' : 'red' }}>{parseFloat(row.diff) > 0 ? `+${row.diff}` : row.diff}</td><td>{row.rsd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '40px', width: '100%', textAlign: 'left' }}>
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
            </div>
            
            {systemStats?.rawDifferentials && <SystemDifferentialChart rawData={systemStats.rawDifferentials} />}
            
            <hr style={{ margin: '40px auto 20px auto', width: '90%', border: '0', borderTop: '1px solid #ddd' }} />
            <p style={{ margin: 20, fontSize: '1.2rem', color: '#666' }}>Behind the dashboard is a complete analytical framework — explore the full research, methodology, and findings below.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '40px' }}>
              <a href="/manuals/MEC_Shot_Quality_Study.pdf" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', backgroundColor: '#16a085', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                📄 System Scoring Study Write-Up (PDF)
              </a>
              <a href="/manuals/Shot_Quality_Scoring_System_Presentation.pdf" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', backgroundColor: '#2980b9', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
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