import React, { useState } from 'react';
import { PricePath } from './MarketMakerDashboard';

interface TrajectoryChartProps {
  wealthPaths: number[][];
  pricePaths: PricePath[];
  maxPathsToRender?: number;
}

export default function TrajectoryChart({
  wealthPaths,
  pricePaths,
  maxPathsToRender = 10
}: TrajectoryChartProps) {
  const [activeTab, setActiveTab] = useState<'wealth' | 'price'>('wealth');

  if (!wealthPaths || wealthPaths.length === 0) return null;

  // Slice paths for visual rendering
  const visibleWealth = wealthPaths.slice(0, maxPathsToRender);
  const visiblePrice = pricePaths.slice(0, maxPathsToRender);

  // Determine global min/max for scale scaling
  const allWealthValues = visibleWealth.flat();
  const minWealth = Math.min(...allWealthValues);
  const maxWealth = Math.max(...allWealthValues);

  const allPriceValues = visiblePrice.flat().map(p => p.price);
  const minPrice = Math.min(...allPriceValues);
  const maxPrice = Math.max(...allPriceValues);

  // SVG viewport dimensions
  const svgWidth = 600;
  const svgHeight = 180;
  const padding = 20;

  const stepsCount = wealthPaths[0]?.length ?? 1;

  // Helper to map (timestep, value) to SVG (x, y) coordinates
  const getCoordinates = (
    stepIdx: number, 
    val: number, 
    minVal: number, 
    maxVal: number
  ) => {
    const x = padding + (stepIdx / (stepsCount - 1)) * (svgWidth - 2 * padding);
    const range = maxVal - minVal || 1;
    const y = svgHeight - padding - ((val - minVal) / range) * (svgHeight - 2 * padding);
    return { x, y };
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
      {/* Chart Header & Toggle */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-semibold text-slate-200">
          {activeTab === 'wealth' ? 'Monte Carlo Wealth Trajectories ($)' : 'Asset Price Paths ($)'}
        </h3>
        
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('wealth')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'wealth' 
                ? 'bg-emerald-600 text-white font-medium' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Wealth ($)
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'price' 
                ? 'bg-emerald-600 text-white font-medium' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Price Paths
          </button>
        </div>
      </div>

      {/* SVG Canvas Box */}
      <div className="bg-slate-950 rounded-lg border border-slate-800 p-2 relative">
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="w-full h-44 overflow-visible"
        >
          {/* Horizontal Reference Line at Initial Value ($100) */}
          {(() => {
            const minV = activeTab === 'wealth' ? minWealth : minPrice;
            const maxV = activeTab === 'wealth' ? maxWealth : maxPrice;
            const { y } = getCoordinates(0, 100, minV, maxV);
            return (
              <line
                x1={padding}
                y1={y}
                x2={svgWidth - padding}
                y2={y}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })()}

          {/* Render Wealth Lines */}
          {activeTab === 'wealth' &&
            visibleWealth.map((path, pathIdx) => {
              const points = path.map((val, stepIdx) => {
                const { x, y } = getCoordinates(stepIdx, val, minWealth, maxWealth);
                return `${x},${y}`;
              }).join(' ');

              return (
                <polyline
                  key={pathIdx}
                  fill="none"
                  stroke={pathIdx === 0 ? '#10b981' : '#334155'} // Highlight path 0 in bright emerald
                  strokeWidth={pathIdx === 0 ? '2.5' : '1.2'}
                  strokeOpacity={pathIdx === 0 ? '1' : '0.6'}
                  points={points}
                />
              );
            })}

          {/* Render Price Lines + Shock Markers */}
          {activeTab === 'price' &&
            visiblePrice.map((path, pathIdx) => {
              const points = path.map((pt, stepIdx) => {
                const { x, y } = getCoordinates(stepIdx, pt.price, minPrice, maxPrice);
                return `${x},${y}`;
              }).join(' ');

              return (
                <g key={pathIdx}>
                  <polyline
                    fill="none"
                    stroke={pathIdx === 0 ? '#38bdf8' : '#334155'}
                    strokeWidth={pathIdx === 0 ? '2' : '1'}
                    strokeOpacity={pathIdx === 0 ? '1' : '0.5'}
                    points={points}
                  />
                  {/* Red Dots for Shock Steps */}
                  {path.map((pt, stepIdx) => {
                    if (!pt.isShock) return null;
                    if (stepIdx === 0) return null;
                    const prevPrice = path[stepIdx - 1].price
                    const { x, y } = getCoordinates(stepIdx, prevPrice, minPrice, maxPrice);
                    return (
                      <circle
                        key={stepIdx}
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill="#f43f5e"
                        stroke="#881337"
                        strokeWidth="1"
                      />
                    );
                  })}
                </g>
              );
            })}
        </svg>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center text-xs text-slate-500 mt-3">
        <span>Showing {visibleWealth.length} of {wealthPaths.length.toLocaleString()} simulated paths</span>
        <span className="font-mono">
          {activeTab === 'wealth' 
            ? `Range: $${minWealth.toFixed(2)} - $${maxWealth.toFixed(2)}`
            : `Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
          }
        </span>
      </div>
    </div>
  );
}