'use client';
import { useState, useEffect } from "react";
import Image from "next/image";

const southAsianCities = [
  "Delhi",
  "Mumbai",
  "Dhaka",
  "Karachi",
  "Colombo",
  "Kathmandu",
  "Islamabad",
  "Chittagong",
  "Bangalore",
  "Hyderabad",
];

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

// Grid component
function AirQualityGrid() {
  const cols = 9;
  const rows = 7;
  const totalBoxes = 45; // You can adjust this number as needed
  const [grid, setGrid] = useState<(string | null)[][]>([]);

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
    <div className="flex flex-col gap-2 items-center justify-center p-4">
      {grid.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {row.map((imgSrc, colIdx) => (
            imgSrc ? (
              <div key={colIdx} className="w-14 h-14 rounded-lg shadow-md overflow-hidden relative">
                <Image src={imgSrc} alt="Grid box" fill className="object-cover" />
              </div>
            ) : (
              <div key={colIdx} className="w-14 h-14" />
            )
          ))}
        </div>
      ))}
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
          </div>
          {/* Right: City Dropdown */}
          <div className="flex-1 flex items-start justify-center md:justify-end w-full">
            <div className="bg-gray-300 bg-opacity-90 rounded-xl p-8 w-full max-w-md min-h-[350px] flex flex-col">
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
                {southAsianCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>
      {/* Screen 2 */}
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-900 p-4">
        <div className="flex flex-row w-full h-[90vh] max-w-7xl rounded-2xl border-4 border-black overflow-hidden shadow-2xl">
          {/* Left: Grid */}
          <div className="flex-1 flex items-center justify-center">
            <AirQualityGrid />
          </div>
          {/* Right: Air Quality Panel */}
          <div className="w-[350px] bg-gradient-to-b from-yellow-200 to-yellow-400 border-l-4 border-black p-6 flex flex-col justify-between">
            <div>
              <div className="text-4xl font-extrabold mb-4 drop-shadow text-black fredoka">Air Quality</div>
              <LineGraph label="Area CO (ppb)" />
              <LineGraph label="Area NO2 (ppb)" />
              <LineGraph label="Area SO2 (ppb)" />
              <LineGraph label="Area PM2.5 (ppb)" />
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
