'use client';
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// Helper for random color
const gridColors = ["bg-red-400", "bg-orange-400", "bg-green-400"];
function getRandomColor() {
  return gridColors[Math.floor(Math.random() * gridColors.length)];
}

const gridImages = [
  "/images/Red.png",
  "/images/Orange.png",
  "/images/Green.png",
];
function getRandomImage() {
  return gridImages[Math.floor(Math.random() * gridImages.length)];
}

// Helper for pollutant colors
const pollutantColors: Record<string, string> = {
  CO: "#f87171", // red-400
  NO2: "#fbbf24", // yellow-400
  SO2: "#60a5fa", // blue-400
  "PM2.5": "#34d399", // green-400
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
function AirQualityGrid() {
  const cols = 9;
  const rows = 7;
  const totalBoxes = 45; // You can adjust this number as needed
  const [grid, setGrid] = useState<(string | null)[][]>([]);
  const [popup, setPopup] = useState<{show: boolean, x: number, y: number, text: string}>({show: false, x: 0, y: 0, text: ''});

  useEffect(() => {
    // Helper to get neighbors
    function getNeighbors([r, c]: [number, number]) {
      return [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].filter(
        ([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols
      );
    }

    // Start with empty grid
    const newGrid: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
    // Place the first box randomly
    const startRow = Math.floor(Math.random() * rows);
    const startCol = Math.floor(Math.random() * cols);
    newGrid[startRow][startCol] = getRandomImage();
    let placed = 1;
    let filledCells: [number, number][] = [[startRow, startCol]];

    while (placed < totalBoxes) {
      // Find all empty neighbors of filled cells
      const candidates: [number, number][] = [];
      for (const [r, c] of filledCells) {
        for (const [nr, nc] of getNeighbors([r, c])) {
          if (newGrid[nr][nc] === null && !candidates.some(([cr, cc]) => cr === nr && cc === nc)) {
            candidates.push([nr, nc]);
          }
        }
      }
      if (candidates.length === 0) break; // No more places to expand
      // Pick a random candidate
      const [cr, cc] = candidates[Math.floor(Math.random() * candidates.length)];
      newGrid[cr][cc] = getRandomImage();
      filledCells.push([cr, cc]);
      placed++;
    }
    setGrid(newGrid);
  }, []);

  if (grid.length === 0) {
    return <div style={{ minHeight: 400 }} />;
  }

  return (
    <div className="flex flex-col gap-2 items-center justify-center p-4 relative">
      {grid.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {row.map((imgSrc, colIdx) => (
            imgSrc ? (
              <div 
                key={colIdx} 
                className="w-20 h-20 rounded-lg shadow-md overflow-hidden relative cursor-pointer hover:scale-105 transition-transform"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPopup({
                    show: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    text: `Air Quality Data for Grid ${rowIdx}-${colIdx}: PM2.5: 45 µg/m³, AQI: Moderate`
                  });
                }}
              >
                <Image src={imgSrc} alt="Grid box" fill className="object-cover" />
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
  const screen2Ref = useRef<HTMLDivElement>(null);

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
    fetchPollutantData(selectedCity)
      .then(setPollutantData)
      .finally(() => setLoading(false));
  }, [selectedCity]);

  return (
    <div className="scroll-smooth">
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
            <div className="bg-gray-300 bg-opacity-90 rounded-xl p-8 w-full max-w-md min-h-[350px] flex flex-col justify-center items-center">
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
      <section ref={screen2Ref} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-900 p-0">
        <div className="flex flex-row w-full h-screen max-h-screen rounded-none border-0 overflow-hidden">
          {/* Left: Grid */}
          <div className="flex-1 flex items-center justify-center h-full">
            <AirQualityGrid />
          </div>
          {/* Right: Air Quality Panel */}
          <div className="w-[400px] bg-gradient-to-b from-yellow-200 to-yellow-400 border-l-4 border-black p-8 flex flex-col justify-between h-full">
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
              <div className="flex gap-3">
                <Image src="/images/BusIcon.png" alt="Bus Icon" width={50} height={50} />
                <Image src="/images/Windmill.png" alt="Windmill Icon" width={50} height={50} />
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Screen 3 */}
      <section className="min-h-screen flex items-center justify-center bg-black text-white">
        <h1 className="text-5xl font-bold">Screen 3 (Black)</h1>
      </section>
    </div>
  );
}
