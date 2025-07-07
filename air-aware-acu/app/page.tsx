'use client';
import { useState } from "react";

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
          <div className="flex-1 flex flex-col items-center md:items-start justify-center text-white max-w-2xl">
            <h1 className="text-7xl md:text-8xl font-extrabold mb-4 text-center md:text-left" style={{ fontFamily: 'cursive, sans-serif' }}>AIR<br />POLLUTION</h1>
            <p className="text-2xl md:text-3xl font-bold text-center md:text-left">
              Air pollution is a growing problem around the world. Learn about what <span className="uppercase">you</span> can do to help!
            </p>
          </div>
          {/* Right: City Dropdown */}
          <div className="flex-1 flex items-start justify-center md:justify-end w-full">
            <div className="bg-gray-300 bg-opacity-90 rounded-xl p-8 w-full max-w-md min-h-[350px] flex flex-col">
              <label className="text-3xl font-extrabold mb-6 text-gray-800" htmlFor="city-select" style={{ fontFamily: 'cursive, sans-serif' }}>
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
      <section className="min-h-screen flex items-center justify-center bg-white text-black">
        <h1 className="text-5xl font-bold">Screen 2 (White)</h1>
      </section>
      {/* Screen 3 */}
      <section className="min-h-screen flex items-center justify-center bg-black text-white">
        <h1 className="text-5xl font-bold">Screen 3 (Black)</h1>
      </section>
    </div>
  );
}
