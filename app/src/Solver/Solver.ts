import { MarketParams } from "../components/MarketMakerDashboard";

export const solveMDP = (params: MarketParams): number[] => {
  const { lambdaShock, spreadMargin, volatility, maxHoldSteps } = params;
  
  const T = maxHoldSteps;
  const optimalF: number[] = new Array(T).fill(0);
  const V: number[] = new Array(T + 1).fill(0); // Value function continuation array

  // Grid resolution for search over allocation fraction f in [0, 1]
  const GRID_STEPS = 1000;
  const fGrid: number[] = [];
  for (let i = 0; i <= GRID_STEPS; i++) {
    fGrid.push(i / GRID_STEPS);
  }

  // Backward Induction from T-1 down to 0
  for (let t = T - 1; t >= 0; t--) {
    let bestVal = -Infinity;
    let bestF = 0;

    for (const f of fGrid) {
      if (f === 0) {
        if (0 > bestVal) {
          bestVal = 0;
          bestF = 0;
        }
        continue;
      }

      const remainingSteps = T - t;

      // Convert spread distance g to discrete steps relative to vol (min 1 step)
      const barrierSteps = Math.max(1, Math.round((2 * spreadMargin) / volatility));

      let expectedUtility = 0;
      let cumulativeFillProb = 0;

      // Sum over all possible first-passage arrival steps k within remaining window
      for (let k = 1; k <= remainingSteps; k++) {
        const pFillAtK = getFirstPassageProb(k, barrierSteps);
        if (pFillAtK <= 0) continue;

        cumulativeFillProb += pFillAtK;

        // Survival vs Shock probability over k steps
        const probSurvive = Math.pow(1 - lambdaShock, k);
        const probShock = 1 - probSurvive;

        // Log returns
        const logReturnFill = Math.log(1 + spreadMargin * f); // Ask filled at margin
        const logReturnShock = Math.log(Math.max(1e-6, 1 - f)); // Shock hit while waiting

        // Contribution to utility for fill occurring at step k
        expectedUtility += pFillAtK * (probSurvive * logReturnFill + probShock * logReturnShock);
      }

      // Unfilled branch (price fails to hit ask before T_max expires)
      const pUnfilled = Math.max(0, 1 - cumulativeFillProb);
      if (pUnfilled > 0) {
        const probSurviveAll = Math.pow(1 - lambdaShock, remainingSteps);
        const probShockAll = 1 - probSurviveAll;

        // If unfilled, inventory is liquidated/carried over + continuation value
        const logReturnUnfilled = Math.log(Math.max(1e-6, 1 - volatility * f)) + V[t + 1];
        const logReturnShock = Math.log(Math.max(1e-6, 1 - f));

        expectedUtility += pUnfilled * (probSurviveAll * logReturnUnfilled + probShockAll * logReturnShock);
      }

      if (expectedUtility > bestVal) {
        bestVal = expectedUtility;
        bestF = f;
      }
    }

    V[t] = bestVal;
    optimalF[t] = parseFloat(bestF.toFixed(4));
  }

  return optimalF;
};


// --- HELPER: Exact Discrete First-Passage Time Probability P(tau = k) ---
// Probability that a standard symmetric random walk first touches threshold +d at step k
function getFirstPassageProb(k: number, d: number): number {
  if (k < d || (k - d) % 2 !== 0) return 0;
  
  // Combinatorial factor: (|d|/k) * C(k, (k+d)/2) * (0.5)^k
  const n = k;
  const r = (k + d) / 2;
  
  // Compute log combinations to prevent overflow
  let logComb = 0;
  for (let i = 1; i <= r; i++) {
    logComb += Math.log((n - r + i) / i);
  }
  
  const logProb = Math.log(d / k) + logComb - k * Math.LN2;
  return Math.exp(logProb);
}