import React, { useState } from 'react';
import { Play, RotateCcw, Sliders, Activity, BarChart3, ShieldAlert } from 'lucide-react';
import "tailwindcss"

// --- TYPES ---
export interface MarketParams {
  lambdaShock: number;  // Per-step shock probability (e.g. 0.02)
  volatility: number;   // Continuous volatility (sigma)
  spreadMargin: number; // Half-spread capture g (e.g. 0.01)
  maxHoldSteps: number; // T_max before hard stop
  numSimulations: number; // N paths to run
  stepsPerSimulation: number; // Timesteps in each path
}

export interface SimulationResults {
  optimalF: number[];
  userF: number[];
  expectedGrowthRate: number;
  sharpeRatio: number;
  probRuin: number;
  wealthPaths: number[][]; // [pathIndex][timestep]
}

// --- STUB FUNCTIONS FOR BACKEND/WORKER LOGIC ---
const stubSolveMDP = (params: MarketParams): number[] => {
  // Mocking backward induction output for optimal f(t)
  const f = [];
  const base = params.spreadMargin * 5; // e.g., ~5% initial
  for (let t = 0; t < params.maxHoldSteps; t++) {
    f.push(parseFloat((base * Math.pow(0.35, t)).toFixed(4)));
  }
  return f;
};

const stubRunMonteCarlo = (params: MarketParams, fCurve: number[]): SimulationResults => {
  // Mocking N simulation runs
  const steps = params.stepsPerSimulation;
  const paths: number[][] = [];
  
  for (let i = 0; i < 5; i++) { // Generate 5 representative paths for rendering
    let wealth = 100;
    const path = [wealth];
    for (let t = 1; t <= steps; t++) {
      const shock = Math.random() < params.lambdaShock;
      if (shock) {
        wealth *= (1 - fCurve[0]); // Shock impact
      } else {
        wealth += wealth * fCurve[0] * params.spreadMargin * (Math.random() > 0.5 ? 1 : -0.2);
      }
      path.push(parseFloat(wealth.toFixed(2)));
    }
    paths.push(path);
  }

  return {
    optimalF: fCurve,
    userF: [...fCurve],
    expectedGrowthRate: 0.0024,
    sharpeRatio: 1.42,
    probRuin: 0.012,
    wealthPaths: paths
  };
};

// --- MAIN MONOLITHIC COMPONENT ---
export default function MarketMakerDashboard() {
  // 1. Model & Simulation Parameters State
  const [params, setParams] = useState<MarketParams>({
    lambdaShock: 0.02,
    volatility: 0.15,
    spreadMargin: 0.01,
    maxHoldSteps: 5,
    numSimulations: 10000,
    stepsPerSimulation: 100,
  });

  // 2. Custom Override f(t) Curve State
  const [useCustomCurve, setUseCustomCurve] = useState<boolean>(false);
  const [customF, setCustomF] = useState<number[]>([0.052, 0.018, 0.004, 0.001, 0.0]);

  // 3. Execution & Stored Results State
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [results, setResults] = useState<SimulationResults | null>(null);

  // Parameter Change Handler (Does NOT auto-trigger simulation)
  const handleParamChange = (field: keyof MarketParams, value: number) => {
    setParams(prev => {
      const updated = { ...prev, [field]: value };
      // Resize custom curve array if maxHoldSteps changes
      if (field === 'maxHoldSteps' && value !== prev.maxHoldSteps) {
        const newCustom = Array(value).fill(0).map((_, i) => customF[i] ?? 0.0);
        setCustomF(newCustom);
      }
      return updated;
    });
  };

  // Custom Curve Slider Change Handler
  const handleCustomFChange = (index: number, val: number) => {
    const updated = [...customF];
    updated[index] = parseFloat(val.toFixed(4));
    setCustomF(updated);
  };

  // Explicit Trigger Button
  const handleRunSimulation = () => {
    setIsCalculating(true);
    
    // Defer to allow UI to show loading spinner state
    setTimeout(() => {
      const optimalF = stubSolveMDP(params);
      if (!useCustomCurve || customF.length !== params.maxHoldSteps) {
        setCustomF(optimalF);
      }
      
      const activeF = useCustomCurve ? customF : optimalF;
      const simResults = stubRunMonteCarlo(params, activeF);
      
      setResults(simResults);
      setIsCalculating(false);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <Activity className="h-6 w-6" /> Market Maker MDP & Simulation Workbench
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Kou Jump-Diffusion + Poisson Crash Risk Optimal Fractional Kelly Sizer
          </p>
        </div>
        <button
          onClick={handleRunSimulation}
          disabled={isCalculating}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg transition-all cursor-pointer"
        >
          {isCalculating ? (
            <RotateCcw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
          {isCalculating ? 'Solving MDP...' : 'Run Optimization & Simulation'}
        </button>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls & Parameters (4 cols) */}
        <div className="lg:col-span-4 space-y-6 bg-slate-900/60 p-5 rounded-xl border border-slate-800">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" /> Model Controls
          </h2>

          <div className="space-y-4">
            {/* Crash Probability Slider */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Crash Risk (λ_shock / step)</span>
                <span className="font-mono text-emerald-400">{(params.lambdaShock * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range" min="0.001" max="0.10" step="0.001"
                value={params.lambdaShock}
                onChange={e => handleParamChange('lambdaShock', parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Half Spread Gain Slider */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Half-Spread Margin (g)</span>
                <span className="font-mono text-emerald-400">{(params.spreadMargin * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range" min="0.002" max="0.05" step="0.001"
                value={params.spreadMargin}
                onChange={e => handleParamChange('spreadMargin', parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Continuous Volatility Slider */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Vol (σ)</span>
                <span className="font-mono text-emerald-400">{(params.volatility * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min="0.05" max="0.50" step="0.01"
                value={params.volatility}
                onChange={e => handleParamChange('volatility', parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Max Hold Horizon Slider */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Max Hold Horizon (T_max)</span>
                <span className="font-mono text-emerald-400">{params.maxHoldSteps} steps</span>
              </div>
              <input
                type="range" min="2" max="10" step="1"
                value={params.maxHoldSteps}
                onChange={e => handleParamChange('maxHoldSteps', parseInt(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Monte Carlo Path Count */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Simulation Paths (N)</span>
                <span className="font-mono text-emerald-400">{params.numSimulations.toLocaleString()}</span>
              </div>
              <select
                value={params.numSimulations}
                onChange={e => handleParamChange('numSimulations', parseInt(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
              >
                <option value={1000}>1,000</option>
                <option value={10000}>10,000</option>
                <option value={50000}>50,000</option>
              </select>
            </div>

            {/* Monte Carlo Step Count Slider */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">Timesteps in each simulation</span>
                <span className="font-mono text-emerald-400">{params.stepsPerSimulation} steps</span>
              </div>
              <input
                type="range" min="10" max="400" step="10"
                value={params.stepsPerSimulation}
                onChange={e => handleParamChange('stepsPerSimulation', parseInt(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          {/* Interactive f(t) Override Panel */}
          <div className="border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-200">Custom f(t) Override</span>
              <input
                type="checkbox"
                checked={useCustomCurve}
                onChange={e => setUseCustomCurve(e.target.checked)}
                className="rounded accent-emerald-500 h-4 w-4"
              />
            </div>

            {useCustomCurve && (
              <div className="space-y-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                {customF.map((val, t) => (
                  <div key={t} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-slate-400 w-12">f({t}):</span>
                    <input
                      type="range" min="0.0" max="0.20" step="0.001"
                      value={val}
                      onChange={e => handleCustomFChange(t, parseFloat(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="font-mono text-emerald-400 w-12 text-right">
                      {(val * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Visualization (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {results ? (
            <>
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Log Growth (G)</span>
                  <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    +{(results.expectedGrowthRate * 100).toFixed(3)}% / step
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Sharpe Ratio</span>
                  <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {results.sharpeRatio.toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Prob of Ruin</span>
                  <p className="text-xl font-bold font-mono text-rose-400 mt-1 flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4" /> {(results.probRuin * 100).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Computed Optimal Policy Table/Visualizer */}
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
                <h3 className="text-md font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-400" /> Target Allocation Policy f(t)
                </h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {(useCustomCurve ? results.userF : results.optimalF).map((val, t) => (
                    <div key={t} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <span className="text-xs text-slate-500 block">Step {t}</span>
                      <span className="text-lg font-mono font-bold text-emerald-400">
                        {(val * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulation Placeholder Chart Box */}
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl h-64 flex flex-col justify-between">
                <h3 className="text-md font-semibold text-slate-200">Monte Carlo Wealth Trajectories</h3>
                <div className="flex-1 my-2 bg-slate-950 rounded-lg border border-slate-800 p-4 flex items-center justify-center text-slate-600 font-mono text-xs">
                  [ Render Chart Here: {params.numSimulations.toLocaleString()} Simulated Trajectories ]
                </div>
                <p className="text-xs text-slate-500 text-right">
                  Sample path final values range: $92.40 to $108.12
                </p>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-12 text-center h-full flex flex-col items-center justify-center text-slate-500">
              <Activity className="h-12 w-12 text-slate-700 mb-3" />
              <p className="text-base font-medium">No Simulation Results Yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Adjust the model parameters on the left and click "Run Optimization & Simulation".
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}