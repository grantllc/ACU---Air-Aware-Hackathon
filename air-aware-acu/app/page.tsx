'use client';
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import EarthIcon from "../public/images/EarthIcon.png";

const gridImages = [
  "/images/Red.png",
  "/images/Orange.png",
  "/images/Green.png",
];

// Helper for pollutant colors
const pollutantColors: Record<string, string> = {
  CO: "#f87171", // red-400
  NO2: "#fbbf24", // yellow-400
  SO2: "#60a5fa", // blue-400
  "PM2.5": "#34d399", // green-400
};

// Tool costs mapping
const toolCosts: Record<string, number> = {
  "bus": 15,
  "windmill": 25,
};

// Tool effects mapping
const toolEffects: Record<string, { 
  area: number, // 2x2 or 3x3
  reductions: { [key: string]: number },
  improvementRate: number // seconds to reach full effectiveness
}> = {
  "bus": {
    area: 2, // 2x2 grid
    reductions: {
      "co": 0.3,
      "no2": 0.5,
      "so2": 0,
      "pm25": 5
    },
    improvementRate: 8 // 8 seconds to reach full effectiveness
  },
  "windmill": {
    area: 3, // 3x3 grid
    reductions: {
      "co": 0.2,
      "no2": 0.2,
      "so2": 0.2,
      "pm25": 5
    },
    improvementRate: 12 // 12 seconds to reach full effectiveness
  }
};

// Fetch OpenAQ data for a city and pollutants
async function fetchPollutantData(city: string) {
  const res = await fetch(`/api/openaq?city=${encodeURIComponent(city)}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return await res.json();
}

// Simple SVG line graph
function MiniLineGraph({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length === 0) return <svg width={120} height={40} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = (v: number) =>
    30 - ((v - min) / (max - min || 1)) * 30 + 5; // y position
  const points = values.map((v, i) => `${10 * i},${norm(v)}`).join(" ");
  return (
    <svg width={120} height={40}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={3}
        points={points}
      />
      <circle cx={110} cy={norm(values[values.length - 1])} r={4} fill={color} />
    </svg>
  );
}

// Grid component
function AirQualityGrid({ pollutantData, gridActive, selectedTool, setSelectedTool, ecoPoints, setEcoPoints, gameOver, removalMode, setRemovalMode, toolImprovementProgress, setToolImprovementProgress, pollutionBaseline, setPollutionBaseline, totalImprovement, setTotalImprovement }: { 
  pollutantData: any, 
  gridActive: boolean, 
  selectedTool: "bus" | "windmill" | null, 
  setSelectedTool: React.Dispatch<React.SetStateAction<"bus" | "windmill" | null>>,
  ecoPoints: number,
  setEcoPoints: React.Dispatch<React.SetStateAction<number>>,
  gameOver: boolean,
  removalMode: boolean,
  setRemovalMode: React.Dispatch<React.SetStateAction<boolean>>,
  toolImprovementProgress: {[key: string]: number},
  setToolImprovementProgress: React.Dispatch<React.SetStateAction<{[key: string]: number}>>,
  pollutionBaseline: {[key: string]: {co: number, no2: number, so2: number, pm25: number}},
  setPollutionBaseline: React.Dispatch<React.SetStateAction<{[key: string]: {co: number, no2: number, so2: number, pm25: number}}>>,
  totalImprovement: number,
  setTotalImprovement: React.Dispatch<React.SetStateAction<number>>
}) {
  const cols = 9;
  const rows = 7;
  type GridTile = {
    imgSrc: string;
    color: string;
    composite: number;
    co: number;
    no2: number;
    so2: number;
    pm25: number;
    tool?: "bus" | "windmill" | null;
  };
  const [grid, setGrid] = useState<(GridTile | null)[][]>([]);
  const [popup, setPopup] = useState<{show: boolean, x: number, y: number, text: string}>({show: false, x: 0, y: 0, text: ''});
  const [warning, setWarning] = useState<{show: boolean, message: string}>({show: false, message: ''});
  const [previewTile, setPreviewTile] = useState<{row: number, col: number} | null>(null);
  const [removalPreview, setRemovalPreview] = useState<{show: boolean, x: number, y: number, refund: number}>({show: false, x: 0, y: 0, refund: 0});

  // Calculate eco points earned from pollution improvement
  const calculateEcoPointsEarned = (improvement: number) => {
    // Base earning: 1 point per 10% improvement
    // Bonus for significant improvements
    if (improvement >= 50) return Math.floor(improvement / 10) + 10; // Bonus for 50%+ improvement
    if (improvement >= 30) return Math.floor(improvement / 10) + 5;  // Bonus for 30%+ improvement
    return Math.floor(improvement / 10);
  };

  // Effect to update eco points based on pollution improvement
  useEffect(() => {
    console.log('Eco point calculation triggered', {
      toolProgressKeys: Object.keys(toolImprovementProgress),
      gridLength: grid.length,
      baselineKeys: Object.keys(pollutionBaseline)
    });
    
    if (Object.keys(toolImprovementProgress).length === 0) return;

    let totalImprovementPercent = 0;
    let tilesImproved = 0;

    // Calculate total improvement across all tiles
    grid.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        if (tile) {
          const tileKey = `${rowIdx}-${colIdx}`;
          const baseline = pollutionBaseline[tileKey];
          
          if (baseline) {
            const effectivePollution = getEffectivePollution(tile, rowIdx, colIdx);
            
            // Calculate improvement percentage for each pollutant
            const coImprovement = Math.max(0, (baseline.co - effectivePollution.co) / baseline.co * 100);
            const no2Improvement = Math.max(0, (baseline.no2 - effectivePollution.no2) / baseline.no2 * 100);
            const so2Improvement = Math.max(0, (baseline.so2 - effectivePollution.so2) / baseline.so2 * 100);
            const pm25Improvement = Math.max(0, (baseline.pm25 - effectivePollution.pm25) / baseline.pm25 * 100);
            
            // Average improvement for this tile
            const tileImprovement = (coImprovement + no2Improvement + so2Improvement + pm25Improvement) / 4;
            
            console.log(`Tile ${tileKey}:`, {
              baseline: baseline,
              effective: effectivePollution,
              improvements: { co: coImprovement, no2: no2Improvement, so2: so2Improvement, pm25: pm25Improvement },
              average: tileImprovement
            });
            
            if (tileImprovement > 5) { // Only count tiles with meaningful improvement
              totalImprovementPercent += tileImprovement;
              tilesImproved++;
            }
          }
        }
      });
    });

    // Calculate average improvement and earn points
    if (tilesImproved > 0) {
      const averageImprovement = totalImprovementPercent / tilesImproved;
      const pointsEarned = calculateEcoPointsEarned(averageImprovement);
      
      if (pointsEarned > 0) {
        setEcoPoints(prev => prev + pointsEarned);
        setTotalImprovement(averageImprovement);
        console.log(`Earned ${pointsEarned} eco points from ${averageImprovement.toFixed(1)}% improvement`);
      }
    }
  }, [toolImprovementProgress, grid, pollutionBaseline]);

  // Helper function to get affected tiles for a tool placement
  const getAffectedTiles = (centerRow: number, centerCol: number, toolType: string) => {
    if (!toolType || !toolEffects[toolType]) {
      return [];
    }
    const area = toolEffects[toolType].area;
    const halfArea = Math.floor(area / 2);
    const affected: [number, number][] = [];
    
    for (let r = centerRow - halfArea; r <= centerRow + halfArea; r++) {
      for (let c = centerCol - halfArea; c <= centerCol + halfArea; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          affected.push([r, c]);
        }
      }
    }
    return affected;
  };

  // Helper function to calculate pollution reduction
  const calculateReduction = (currentValue: number, pollutant: string, toolType: string) => {
    const reduction = toolEffects[toolType].reductions[pollutant] || 0;
    return Math.max(0, currentValue - reduction);
  };

  // Helper function to get effective pollution values for a tile
  const getEffectivePollution = (tile: GridTile, row: number, col: number) => {
    let effectiveCo = tile.co;
    let effectiveNo2 = tile.no2;
    let effectiveSo2 = tile.so2;
    let effectivePm25 = tile.pm25;

    // Check all tiles for tools that affect this tile
    grid.forEach((gridRow, rIdx) => {
      gridRow.forEach((gridTile, cIdx) => {
        if (gridTile?.tool) {
          const affectedTiles = getAffectedTiles(rIdx, cIdx, gridTile.tool);
          if (affectedTiles.some(([ar, ac]) => ar === row && ac === col)) {
            // This tool affects our tile
            const effects = toolEffects[gridTile.tool];
            const toolKey = `${rIdx}-${cIdx}-${gridTile.tool}`;
            const progress = toolImprovementProgress[toolKey] || 0;
            
            console.log(`Tool ${toolKey} affects tile ${row}-${col}:`, {
              tool: gridTile.tool,
              progress: progress,
              effects: effects.reductions,
              before: { co: effectiveCo, no2: effectiveNo2, so2: effectiveSo2, pm25: effectivePm25 }
            });
            
            // Apply gradual improvement based on progress
            effectiveCo = Math.max(0, effectiveCo - (effects.reductions.co * progress));
            effectiveNo2 = Math.max(0, effectiveNo2 - (effects.reductions.no2 * progress));
            effectiveSo2 = Math.max(0, effectiveSo2 - (effects.reductions.so2 * progress));
            effectivePm25 = Math.max(0, effectivePm25 - (effects.reductions.pm25 * progress));
            
            console.log(`After tool effect:`, { co: effectiveCo, no2: effectiveNo2, so2: effectiveSo2, pm25: effectivePm25 });
          }
        }
      });
    });

    return { co: effectiveCo, no2: effectiveNo2, so2: effectiveSo2, pm25: effectivePm25 };
  };

  // Helper function to get tile color/image based on effective pollution
  const getTileAppearance = (effectivePollution: { co: number, no2: number, so2: number, pm25: number }) => {
    // Normalize to 0-100
    const coNorm = Math.min(effectivePollution.co / 10, 1) * 100;
    const no2Norm = Math.min(effectivePollution.no2 / 40, 1) * 100;
    const so2Norm = Math.min(effectivePollution.so2 / 20, 1) * 100;
    const pm25Norm = Math.min(effectivePollution.pm25 / 50, 1) * 100;

    // Composite: average or max
    const composite = Math.max(coNorm, no2Norm, so2Norm, pm25Norm);

    // Color/image
    let imgSrc = gridImages[2], color = "green";
    if (composite > 70) { imgSrc = gridImages[0]; color = "red"; }
    else if (composite >= 40) { imgSrc = gridImages[1]; color = "orange"; }

    return { imgSrc, color, composite };
  };

  useEffect(() => {
    if (!gridActive) return;

    // 1. Get latest values or fallback
    const coSource = pollutantData?.co?.values?.length
      ? pollutantData.co.values[pollutantData.co.values.length - 1]
      : 0.5;
    const no2Source = pollutantData?.no2?.values?.length
      ? pollutantData.no2.values[pollutantData.no2.values.length - 1]
      : 15.2;
    const so2Source = pollutantData?.so2?.values?.length
      ? pollutantData.so2.values[pollutantData.so2.values.length - 1]
      : 2.3;
    const pm25Source = pollutantData?.pm25?.values?.length
      ? pollutantData.pm25.values[pollutantData.pm25.values.length - 1]
      : 35;

    // 2. Random wind direction
    const windDirections = ["right", "left", "up", "down"];
    const wind = windDirections[Math.floor(Math.random() * windDirections.length)];
    function windBias(row: number, col: number) {
      if (wind === "right") return col - sourceCol;
      if (wind === "left") return sourceCol - col;
      if (wind === "down") return row - sourceRow;
      if (wind === "up") return sourceRow - row;
      return 0;
    }

    // 1. Setup
    const minTiles = 40, maxTiles = 63;
    const tilesToFill = Math.floor(Math.random() * (maxTiles - minTiles + 1)) + minTiles;
    const filled = new Set<string>();
    const newGrid: (GridTile | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));

    // 2. Start from source
    const sourceRow = Math.floor(Math.random() * rows);
    const sourceCol = Math.floor(Math.random() * cols);
    const queue: [number, number][] = [[sourceRow, sourceCol]];
    filled.add(`${sourceRow},${sourceCol}`);

    // 3. Random walk/contagion
    while (filled.size < tilesToFill && queue.length > 0) {
      const [r, c] = queue[Math.floor(Math.random() * queue.length)];
      // Find empty neighbors
      const neighbors = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
      ].filter(([nr, nc]) =>
        nr >= 0 && nr < rows && nc >= 0 && nc < cols && !filled.has(`${nr},${nc}`)
      );
      if (neighbors.length === 0) {
        // Remove this tile from queue if no more neighbors
        queue.splice(queue.findIndex(([qr, qc]) => qr === r && qc === c), 1);
        continue;
      }
      // Randomly pick a neighbor to fill
      const [nr, nc] = neighbors[Math.floor(Math.random() * neighbors.length)];
      filled.add(`${nr},${nc}`);
      queue.push([nr, nc]);
    }

    // 4. For each filled tile, calculate values as before
    filled.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const dist = Math.abs(r - sourceRow) + Math.abs(c - sourceCol);
      const bias = windBias(r, c);

      // Decay and noise for each pollutant
      let co = Math.max(coSource - 0.1 * dist + 0.05 * bias + (Math.random() - 0.5) * 0.2, 0.1);
      let no2 = Math.max(no2Source - 0.1 * dist + 0.05 * bias + (Math.random() - 0.5) * 0.2, 0.1);
      let so2 = Math.max(so2Source - 0.1 * dist + 0.05 * bias + (Math.random() - 0.5) * 0.2, 0.1);
      let pm25 = Math.max(pm25Source - 2 * dist + bias + (Math.random() - 0.5) * 6, 10);

      // Normalize to 0-100
      const coNorm = Math.min(co / 10, 1) * 100;
      const no2Norm = Math.min(no2 / 40, 1) * 100;
      const so2Norm = Math.min(so2 / 20, 1) * 100;
      const pm25Norm = Math.min(pm25 / 50, 1) * 100;

      // Composite: average or max
      const composite = Math.max(coNorm, no2Norm, so2Norm, pm25Norm);

      // Color/image
      let imgSrc = gridImages[2], color = "green";
      if (composite > 70) { imgSrc = gridImages[0]; color = "red"; }
      else if (composite >= 40) { imgSrc = gridImages[1]; color = "orange"; }

      newGrid[r][c] = { imgSrc, color, composite, co, no2, so2, pm25 };
    });

    setGrid(newGrid);
    
    // Set baseline pollution values for eco point calculation
    const newBaseline: {[key: string]: {co: number, no2: number, so2: number, pm25: number}} = {};
    filled.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const tile = newGrid[r][c];
      if (tile) {
        newBaseline[`${r}-${c}`] = {
          co: tile.co,
          no2: tile.no2,
          so2: tile.so2,
          pm25: tile.pm25
        };
      }
    });
    setPollutionBaseline(newBaseline);
  }, [pollutantData, gridActive]);

  if (grid.length === 0) {
    return <div style={{ minHeight: 400 }} />;
  }

  return (
    <div className="flex flex-col gap-2 items-center justify-center p-4 relative">
      {grid.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {row.map((tile, colIdx) => (
            tile ? (
              <div 
                key={colIdx} 
                className={`w-20 h-20 rounded-lg shadow-md overflow-hidden relative cursor-pointer hover:scale-105 transition-transform ${
                  previewTile && selectedTool && getAffectedTiles(previewTile.row, previewTile.col, selectedTool).some(([r, c]) => r === rowIdx && c === colIdx) 
                    ? 'ring-4 ring-green-400 ring-opacity-70' 
                    : ''
                }`}
                onMouseEnter={() => {
                  if (selectedTool && !gameOver && !removalMode) {
                    setPreviewTile({row: rowIdx, col: colIdx});
                  } else if (removalMode && tile.tool && !gameOver) {
                    const refund = Math.ceil(toolCosts[tile.tool] * 0.5);
                    const rect = document.querySelector(`[data-row="${rowIdx}"][data-col="${colIdx}"]`)?.getBoundingClientRect();
                    if (rect) {
                      setRemovalPreview({
                        show: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        refund: refund
                      });
                    }
                  }
                }}
                onMouseLeave={() => {
                  if (selectedTool && !gameOver && !removalMode) {
                    setPreviewTile(null);
                  } else if (removalMode && !gameOver) {
                    setRemovalPreview({show: false, x: 0, y: 0, refund: 0});
                  }
                }}
                data-row={rowIdx}
                data-col={colIdx}
                onClick={(e) => {
                  if (removalMode && tile.tool && !gameOver) {
                    // Remove tool with 50% refund
                    const refund = Math.ceil(toolCosts[tile.tool] * 0.5);
                    const newGrid = grid.map((row, rIdx) =>
                      row.map((t, cIdx) =>
                        rIdx === rowIdx && cIdx === colIdx && t
                          ? { ...t, tool: null }
                          : t
                      )
                    );
                    setGrid(newGrid);
                    setEcoPoints(ecoPoints + refund);
                    setRemovalMode(false);
                    setRemovalPreview({show: false, x: 0, y: 0, refund: 0});
                    return;
                  }
                  
                  if (selectedTool && tile && !gameOver && !removalMode) {
                    // Check if player has enough eco points
                    const cost = toolCosts[selectedTool];
                    if (ecoPoints >= cost) {
                      // Place tool and deduct points
                      const newGrid = grid.map((row, rIdx) =>
                        row.map((t, cIdx) =>
                          rIdx === rowIdx && cIdx === colIdx && t
                            ? { ...t, tool: selectedTool }
                            : t
                        )
                      );
                      setGrid(newGrid);
                      setEcoPoints(ecoPoints - cost);
                      setSelectedTool(null);
                      
                      // Start tracking improvement progress for this tool
                      const toolKey = `${rowIdx}-${colIdx}-${selectedTool}`;
                      setToolImprovementProgress(prev => ({
                        ...prev,
                        [toolKey]: 0
                      }));
                      console.log(`Placed tool: ${toolKey}`);
                    } else {
                      // Show warning for insufficient points
                      setWarning({
                        show: true,
                        message: `Not enough eco points! You need ${cost} points but only have ${ecoPoints}.`
                      });
                      // Hide warning after 3 seconds
                      setTimeout(() => setWarning({show: false, message: ''}), 3000);
                    }
                    return;
                  }
                  if (!gameOver && !removalMode) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const effectivePollution = getEffectivePollution(tile, rowIdx, colIdx);
                    setPopup({
                      show: true,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      text: `CO: ${effectivePollution.co.toFixed(2)} ppb, NO₂: ${effectivePollution.no2.toFixed(2)} ppb, SO₂: ${effectivePollution.so2.toFixed(2)} ppb, PM2.5: ${effectivePollution.pm25.toFixed(1)} µg/m³, AQI: ${getTileAppearance(effectivePollution).composite > 70 ? "Unhealthy" : getTileAppearance(effectivePollution).composite >= 40 ? "Moderate" : "Good"}`
                    });
                  }
                }}
              >
                {(() => {
                  const effectivePollution = getEffectivePollution(tile, rowIdx, colIdx);
                  const appearance = getTileAppearance(effectivePollution);
                  return (
                    <>
                      <Image src={appearance.imgSrc} alt="Grid box" fill className="object-cover" />
                      {tile.tool === "bus" && (
                        <Image 
                          src="/images/BusTransparent.png" 
                          alt="Bus" 
                          fill 
                          className="object-cover z-10" 
                        />
                      )}
                      {tile.tool === "windmill" && (
                        <Image 
                          src="/images/WindmillTransparent.png" 
                          alt="Windmill" 
                          fill 
                          className="object-cover z-10" 
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div key={colIdx} className="w-20 h-20" />
            )
          ))}
        </div>
      ))}
      {popup.show && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setPopup({...popup, show: false})}
          />
          <div 
            className="fixed z-50 bg-white border-2 border-black rounded-lg p-3 shadow-lg max-w-xs"
            style={{
              left: popup.x - 150,
              top: popup.y - 80,
              transform: 'translateX(-50%)'
            }}
          >
            <p className="text-sm font-semibold text-black">{popup.text}</p>
          </div>
        </>
      )}
      {warning.show && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg border-2 border-red-700">
          <p className="text-lg font-bold">{warning.message}</p>
        </div>
      )}
      {removalPreview.show && (
        <div 
          className="fixed z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg border-2 border-green-700"
          style={{
            left: removalPreview.x - 100,
            top: removalPreview.y - 60,
            transform: 'translateX(-50%)'
          }}
        >
          <p className="text-sm font-bold">Refund: +{removalPreview.refund} Eco Points</p>
        </div>
      )}
    </div>
  );
}

// Placeholder for a line graph
function LineGraph({ label }: { label: string }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-bold mb-1 drop-shadow">{label}</div>
      <div className="bg-white/60 rounded h-12 flex items-center justify-center border border-black/20">
        {/* Replace with actual graph logic */}
        <span className="text-gray-400">[Line Graph]</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedCity, setSelectedCity] = useState("");
  const [pollutantData, setPollutantData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [gridActive, setGridActive] = useState(false);
  const [ecoPoints, setEcoPoints] = useState(50);
  const [timer, setTimer] = useState(300); // default 60 seconds
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showGameOverScreen, setShowGameOverScreen] = useState(false);
  const screen2Ref = useRef<HTMLDivElement>(null);
  const screen3Ref = useRef<HTMLDivElement>(null);
  const [selectedTool, setSelectedTool] = useState<"bus" | "windmill" | null>(null);
  const [removalMode, setRemovalMode] = useState(false);
  const [toolImprovementProgress, setToolImprovementProgress] = useState<{[key: string]: number}>({});
  const [pollutionBaseline, setPollutionBaseline] = useState<{[key: string]: {co: number, no2: number, so2: number, pm25: number}}>({});
  const [totalImprovement, setTotalImprovement] = useState(0);
  const [chatMessages, setChatMessages] = useState([
    { role: 'system', content: 'You are an air pollution expert. Only answer air-pollution related questions using the OpenAQ dataset. If a question is not about air pollution, politely refuse.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Function to send message to Grok AI
  async function sendChatMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const input = chatInput.trim();
    if (!input) return;
    setChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'user', content: input }]);
    setChatInput('');
    try {
      const res = await fetch('/api/grok-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are an air pollution expert. Only answer air-pollution related questions using the OpenAQ dataset. If a question is not about air pollution, politely refuse.' },
            ...chatMessages.filter(m => m.role !== 'system'),
            { role: 'user', content: input }
          ]
        })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response || 'No response.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error contacting the AI.' }]);
    }
    setChatLoading(false);
    setTimeout(() => {
      if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }, 100);
  }

  // Timer countdown effect
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(() => {
      setTimer(prevTimer => {
        if (prevTimer <= 1) {
          setGameOver(true);
          setGameStarted(false);
          setShowGameOverScreen(true);
          // Show game over screen for 2 seconds, then scroll to screen 3
          setTimeout(() => {
            setShowGameOverScreen(false);
            if (screen3Ref.current) {
              screen3Ref.current.scrollIntoView({ behavior: 'smooth' });
            }
          }, 2000);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted, gameOver]);

  // Gradual pollution improvement effect
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const improvementInterval = setInterval(() => {
      setToolImprovementProgress(prev => {
        const newProgress = { ...prev };
        // Increase progress for all placed tools based on their individual rates
        Object.keys(newProgress).forEach(key => {
          const [row, col, toolType] = key.split('-');
          const toolEffect = toolEffects[toolType];
          if (toolEffect) {
            const increment = 1 / toolEffect.improvementRate; // Progress per second
            newProgress[key] = Math.min(newProgress[key] + increment, 1);
            console.log(`Tool ${key}: progress ${newProgress[key].toFixed(2)}`);
          }
        });
        return newProgress;
      });
    }, 1000);

    return () => clearInterval(improvementInterval);
  }, [gameStarted, gameOver]);

  // Keyboard event for deselecting tools
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'x' || event.key === 'X') {
        setSelectedTool(null);
        setRemovalMode(false);
        // Clear preview tile state by triggering a state update
        setToolImprovementProgress(prev => ({ ...prev }));
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Format timer as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch available cities on mount
  useEffect(() => {
    async function fetchCities() {
      const res = await fetch("/api/openaq-cities");
      if (res.ok) {
        const data = await res.json();
        setAvailableCities(data.cities);
      }
    }
    fetchCities();
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    setLoading(true);
    setPollutantData(null);
    setGridActive(false); // Reset grid when city changes
    fetchPollutantData(selectedCity)
      .then(setPollutantData)
      .finally(() => setLoading(false));
  }, [selectedCity]);

  return (
    <div className="scroll-smooth">
      {/* Loading Overlay */}
      {loading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-16 w-16 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-white text-2xl font-bold">Loading...</span>
          </div>
        </div>
      )}
      {/* Game Over Screen */}
      {showGameOverScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          <div className="flex flex-col items-center">
            <h1 className="text-6xl font-extrabold text-red-500 mb-4 animate-pulse">GAME OVER</h1>
            <p className="text-2xl text-white mb-4">Time's up!</p>
            <div className="text-xl text-yellow-400">
              Final Score: <span className="font-bold">{ecoPoints}</span> Eco Points
            </div>
          </div>
        </div>
      )}
      {/* Screen 1 with parallax background */}
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Parallax background */}
        <div
          className="absolute inset-0 bg-fixed bg-center bg-cover z-0"
          style={{ backgroundImage: 'url(/images/AirPoln.png)' }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 z-10" />
        {/* Content */}
        <div className="relative z-20 flex flex-col md:flex-row w-full h-full items-center justify-center p-8 gap-8">
          {/* Left: Title and Subtitle */}
          <div className="flex-1 flex flex-col items-center justify-center text-white max-w-2xl h-full min-h-[350px]">
            <h1 className="text-7xl md:text-8xl font-extrabold mb-4 text-center">AIR<br />POLLUTION</h1>
            <p className="text-2xl md:text-3xl font-bold text-center">
              Air pollution is a growing problem around the world. Learn about what <span className="uppercase">you</span> can do to help!
            </p>
            {/* Pollutant Data Card */}
            {selectedCity && (
              <div className="mt-8 w-full max-w-lg bg-white/80 rounded-2xl shadow-xl p-6 border-2 border-black">
                <div className="text-2xl font-bold text-black mb-2 fredoka">{selectedCity} Air Quality</div>
                {loading && <div className="text-black">Loading...</div>}
                {pollutantData && (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "co", label: "CO (ppb)" },
                      { key: "no2", label: "NO₂ (ppb)" },
                      { key: "so2", label: "SO₂ (ppb)" },
                      { key: "pm25", label: "PM2.5 (µg/m³)" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex flex-col items-center bg-white rounded-xl p-3 border border-black/20">
                        <div className="text-lg font-bold mb-1 text-black fredoka">{label}</div>
                        <MiniLineGraph values={pollutantData[key]?.values} color={pollutantColors[label.split(" ")[0]] || "#888"} />
                        <div className="text-2xl font-extrabold mt-2 text-black">
                          {pollutantData[key]?.values.length > 0 ? pollutantData[key].values[pollutantData[key].values.length - 1] : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right: City Dropdown */}
          <div className="flex-1 flex items-center justify-center md:justify-end w-full">
            <div className="bg-gray-300 bg-opacity-90 rounded-xl p-8 w-full max-w-lg min-h-[350px] flex flex-col justify-center items-center">
              <label className="text-3xl font-extrabold mb-6 text-gray-800" htmlFor="city-select">
                Choose a city to investigate:
              </label>
              <select
                id="city-select"
                className="mt-2 p-3 rounded-lg text-xl font-semibold bg-white text-gray-800 shadow"
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
              >
                <option value="" disabled>Select a city</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              {selectedCity && (
                <button
                  className="mt-8 px-8 py-3 rounded-full bg-gradient-to-r from-green-400 to-green-700 text-white text-2xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                  onClick={() => {
                    setGameStarted(true);
                    setGridActive(true);
                    if (screen2Ref.current) {
                      screen2Ref.current.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <svg className="w-7 h-7 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" /></svg>
                  Play
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* Screen 2 */}
      <section ref={screen2Ref} className="min-h-[110vh] flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-900 p-0">
        <div className="flex flex-row w-full rounded-none border-0 overflow-hidden relative" style={{ minHeight: '90vh' }}>
          {/* Timer Badge */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-blue-800 text-white px-8 py-3 rounded-2xl shadow-lg text-2xl font-extrabold border-4 border-blue-300 fredoka flex items-center gap-3">
              <svg className="w-7 h-7 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
              <span>Timer: {formatTime(timer)}</span>
            </div>
          </div>
          {/* Eco Points Badge */}
          <div className="absolute top-8 left-8 z-20">
            <div className="bg-green-500 text-white px-5 py-1 rounded-2xl shadow-lg text-2xl font-extrabold border-4 border-green-700 fredoka flex items-center gap-3">
              <Image src="/images/EarthIcon.png" alt="Earth Icon" width={50} height={50} />
              Eco Points: <span className="text-yellow-200">{ecoPoints}</span>
            </div>
          </div>
          {/* Left: Grid */}
          <div className="flex-1 flex items-center justify-center h-full">
            <AirQualityGrid
              pollutantData={pollutantData}
              gridActive={gridActive}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              ecoPoints={ecoPoints}
              setEcoPoints={setEcoPoints}
              gameOver={gameOver}
              removalMode={removalMode}
              setRemovalMode={setRemovalMode}
              toolImprovementProgress={toolImprovementProgress}
              setToolImprovementProgress={setToolImprovementProgress}
              pollutionBaseline={pollutionBaseline}
              setPollutionBaseline={setPollutionBaseline}
              totalImprovement={totalImprovement}
              setTotalImprovement={setTotalImprovement}
            />
          </div>
          {/* Right: Air Quality Panel */}
          <div className="w-[400px] bg-gradient-to-b from-yellow-200 to-yellow-400 border-l-4 border-black p-8 flex flex-col h-full justify-between">
            <div>
              <div className="text-4xl font-extrabold mb-4 drop-shadow text-black fredoka">Air Quality</div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { key: "co", label: "CO (ppb)" },
                  { key: "no2", label: "NO₂ (ppb)" },
                  { key: "so2", label: "SO₂ (ppb)" },
                  { key: "pm25", label: "PM2.5 (µg/m³)" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center bg-white rounded-xl p-3 border border-black/20">
                    <div className="text-lg font-bold mb-1 text-black fredoka">{label}</div>
                    <MiniLineGraph values={pollutantData?.[key]?.values} color={pollutantColors[label.split(" ")[0]] || "#888"} />
                    <div className="text-2xl font-extrabold mt-2 text-black">
                      {pollutantData?.[key]?.values?.length > 0 ? pollutantData[key].values[pollutantData[key].values.length - 1] : "-"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 bg-green-300 rounded-xl p-4 flex flex-col items-start border-2 border-black">
              <div className="text-2xl font-bold mb-2 fredoka">Tools</div>
              <div className="text-sm text-gray-700 mb-3">Press X to deselect tool</div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setSelectedTool("bus");
                    setRemovalMode(false);
                  }}
                  disabled={gameOver}
                  className={`p-2 rounded-lg hover:bg-green-400 hover:scale-110 active:scale-95 transition-all duration-200 hover:shadow-lg flex flex-col items-center ${gameOver ? 'opacity-50 cursor-not-allowed' : ''} ${selectedTool === "bus" && !removalMode ? 'bg-green-400' : ''}`}
                >
                  <Image 
                    src="/images/BusIcon.png" 
                    alt="Bus Icon" 
                    width={50} 
                    height={50} 
                  />
                  <span className="text-sm font-bold mt-1">Cost: {toolCosts["bus"]}</span>
                </button>
                <button 
                  onClick={() => {
                    setSelectedTool("windmill");
                    setRemovalMode(false);
                  }}
                  disabled={gameOver}
                  className={`p-2 rounded-lg hover:bg-green-400 hover:scale-110 active:scale-95 transition-all duration-200 hover:shadow-lg flex flex-col items-center ${gameOver ? 'opacity-50 cursor-not-allowed' : ''} ${selectedTool === "windmill" && !removalMode ? 'bg-green-400' : ''}`}
                >
                  <Image 
                    src="/images/Windmill.png" 
                    alt="Windmill Icon" 
                    width={50} 
                    height={50} 
                  />
                  <span className="text-sm font-bold mt-1">Cost: {toolCosts["windmill"]}</span>
                </button>
                <button 
                  onClick={() => {
                    setRemovalMode(!removalMode);
                    setSelectedTool(null);
                  }}
                  disabled={gameOver}
                  className={`p-2 rounded-lg hover:bg-red-400 hover:scale-110 active:scale-95 transition-all duration-200 hover:shadow-lg flex flex-col items-center ${gameOver ? 'opacity-50 cursor-not-allowed' : ''} ${removalMode ? 'bg-red-400' : ''}`}
                >
                  <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold mt-1">Remove</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Screen 3 */}
      <section
        ref={screen3Ref}
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-fixed bg-center bg-cover z-0"
          style={{ backgroundImage: 'url(/images/AirPoln.png)', filter: 'brightness(0.7) sepia(0.4)' }}
        />
        {/* Brownish overlay */}
        <div className="absolute inset-0 bg-[#b89c7a]/70 z-10" />
        {/* Main content */}
        <div className="relative z-20 flex flex-col w-full h-full items-center justify-start p-8 gap-8">
          {/* Header */}
          <h1 className="text-6xl md:text-7xl font-extrabold text-white text-center mt-8 mb-2 fredoka tracking-wide">LEARN MORE</h1>
          {/* Description and content row */}
          <div className="flex flex-row w-full max-w-6xl gap-12 mt-2">
            {/* Left: Description and Buttons */}
            <div className="flex flex-col min-w-[260px] max-w-[320px] relative">
              <p className="text-lg font-bold text-white mb-8 text-left leading-snug">
                In the game, you implemented the following techniques. Learn more about how they can improve air quality and what you can do!
              </p>
              <div className="flex flex-col gap-6">
                {(() => {
                  const techniques = [
                    'Public transport',
                    'Clean energy',
                    'Green spaces',
                    'Recycling',
                  ];
                  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);
                  // Expose state to the parent scope
                  (globalThis as any).selectedTechnique = selectedTechnique;
                  (globalThis as any).setSelectedTechnique = setSelectedTechnique;
                  return techniques.map((label, idx) => (
                    <div key={label} className="relative flex items-center">
                      <button
                        onClick={() => setSelectedTechnique(selectedTechnique === label ? null : label)}
                        className={`flex items-center justify-between bg-gray-200/90 hover:bg-gray-300 text-gray-900 font-semibold text-lg px-6 py-3 rounded-xl shadow transition group min-w-[200px] ${selectedTechnique === label ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <span>{label}</span>
                        <span className="ml-4">
                          <svg className="w-7 h-7 text-gray-700 group-hover:text-gray-900" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </span>
                      </button>
                      {/* Info section appears to the right of the clicked button */}
                      {selectedTechnique === label && (
                        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-white/95 border border-gray-300 rounded-xl shadow-lg p-6 min-w-[440px] max-w-2xl z-30">
                          <div className="text-gray-900 text-xl font-bold mb-3">{label}</div>
                          <div className="text-gray-700 text-lg">
                            {label === 'Public transport'
                              ? 'One of the biggest contributors to air pollution in cities is the use of private vehicles (cars) for transportation. By using more public transport, YOU can minimise carbon emissions from private vehicles, and contribute to healthier air quality.'
                              : label === 'Clean energy'
                                ? 'From previous data, cities which rely the most on renewable and clean energy have the cleanest air. Individuals can rely less on fossil fuels and gas and instead power their homes with solar and wind energy to make a real impact on air quality.'
                                : label === 'Green spaces'
                                  ? 'Green spaces not only create more pleasant environments for residents to enjoy, but the plants and greenery also clean up the air. Individuals can lobby for the construction of green spaces in their area. '
                                  : 'Recycling is a great way to reduce the amount of waste that ends up in landfills. By recycling, you can reduce the amount of waste that ends up in landfills, and contribute to healthier air quality.'}
                          </div>
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>
            {/* Right: Info Box */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full h-[320px] md:h-[340px] bg-gray-200/80 rounded-2xl shadow-xl border-2 border-white flex items-center justify-center">
                {/* Placeholder for info content */}
                <span className="text-gray-400 text-2xl font-bold">Select a technique to learn more!</span>
              </div>
              {/* Chatbot Box */}
              <div className="w-full mt-8 bg-blue-400/90 rounded-2xl shadow-lg p-4 flex flex-col items-start border-2 border-blue-700">
                <div className="text-white font-bold text-lg mb-2">Any Questions?<br />Ask our AI chatbot.</div>
                <div ref={chatBoxRef} className="w-full h-48 bg-white rounded-lg p-3 mb-3 overflow-y-auto flex flex-col gap-2">
                  {chatMessages.filter(m => m.role !== 'system').map((msg, i) => (
                    <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                      <span className={msg.role === 'user' ? 'bg-blue-200 text-blue-900 px-3 py-2 rounded-xl inline-block' : 'bg-gray-200 text-gray-800 px-3 py-2 rounded-xl inline-block'}>
                        {msg.content}
                      </span>
                    </div>
                  ))}
                  {chatLoading && <div className="text-gray-500">AI is typing...</div>}
                </div>
                <form onSubmit={sendChatMessage} className="w-full flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-lg p-3 text-lg text-gray-800 bg-white border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Type your question here..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-50"
                    disabled={chatLoading || !chatInput.trim()}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
