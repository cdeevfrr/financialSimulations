import { MarketParams, PricePath, SimulationResults } from "../components/MarketMakerDashboard";

export function runMonteCarlo (params: MarketParams, fCurve: number[]): SimulationResults {
  const N = params.numSimulations;
  const steps = params.stepsPerSimulation;
  
  const initialWealth = 100;
  const initialPrice = 100;

  let totalRuinCount = 0;
  const stepLogReturns: number[] = []; // Collect per-step log growth rates across all paths
  
  const wealthPaths: number[][] = [];
  const pricePaths: PricePath[] = [];

  for (let i = 0; i < N; i++) {
    let cash = initialWealth;
    let currentPrice = initialPrice;
    
    // Inventory management tracking
    let openAsks: Array<{price: number, amount: number}> = [];
    // We will track inventoryUnits as sum(openAsks.amount)

    const wealthPath: number[] = [initialWealth];
    const pricePath: PricePath = [{ price: currentPrice, isShock: false }];

    for (let t = 1; t <= steps; t++) {
      // 1. Evaluate Catastrophic Shock vs. Continuous Price Step
      const isShock = Math.random() < params.lambdaShock;

      if (isShock) {
        // --- SHOCK EVENT ---
        // Active bid commitment + held inventory wiped out completely
        const openBidAmount = (openAsks.length < fCurve.length) ? cash * fCurve[openAsks.length] : 0;
        
        cash = Math.max(0, cash - openBidAmount);
        openAsks = [];
        currentPrice = initialPrice; 
        // Why do we set price to the start value after a shock?
        // To dramatically represent "we get picked off by toxic flow," we imagine a
        // worst possible case scenario where all our current investment in one coin goes
        // to zero, and we're now investing in another coin. The new coin's price can 
        // be reset to the start value. 
      } else {
        // --- NORMAL TIMESTEP ---
        const newPrice = computeNextPriceBrownian(params, currentPrice)

        // A. Check if existing ask order is hit (only when price goes up)
        const newOpenAsks: typeof openAsks = [];
        for (const ask of openAsks){
            if (newPrice > ask.price){
                cash += ask.amount * ask.price; // Collect ask fill in cash
            } else {
                newOpenAsks.push(ask)
            }
        }
        openAsks = newOpenAsks

        // B. Check if our old bid posting under f(t) got hit by price going down
        if (openAsks.length < fCurve.length && cash > 0) {
          const bidFraction = fCurve[openAsks.length];
          const bidAmount = cash * bidFraction;
          const bidPrice = currentPrice * (1 - params.spreadMargin);

          // Did price move down enough to fill our posted bid?
          if (newPrice <= bidPrice && bidAmount > 0) {
            const filledUnits = bidAmount / bidPrice;
            cash -= bidAmount;
            
            // Post ask at entry price + margin (or target ask)
            openAsks.push ({
                price: bidPrice * (1 + 2 * params.spreadMargin),
                amount: filledUnits
            });
          }
        } 
        currentPrice = newPrice;
      }

      // Total Portfolio Liquidation Value
      const askAmount = openAsks.reduce((sum, ask) => {return sum + ask.amount}, 0)
      const totalPortfolioValue = cash + (askAmount * currentPrice);

      // Track log growth rate per step
      const prevVal = wealthPath[wealthPath.length - 1];
      if (prevVal > 0 && totalPortfolioValue > 0) {
        stepLogReturns.push(Math.log(totalPortfolioValue / prevVal));
      }

      wealthPath.push(parseFloat(totalPortfolioValue.toFixed(2)));
      pricePath.push({ price: parseFloat(currentPrice.toFixed(2)), isShock });

      if (totalPortfolioValue <= 0.01) {
        totalRuinCount++;
        break; // Bankrupt
      }
    }

    wealthPaths.push(wealthPath);
    pricePaths.push(pricePath);
  }

  // --- STATISTICAL SUMMARY CALCULATIONS ---
  const meanLogGrowth = stepLogReturns.length > 0 
    ? stepLogReturns.reduce((a, b) => a + b, 0) / stepLogReturns.length 
    : 0;

  const variance = stepLogReturns.length > 0
    ? stepLogReturns.reduce((a, b) => a + Math.pow(b - meanLogGrowth, 2), 0) / stepLogReturns.length
    : 0;
  
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (meanLogGrowth / stdDev) * Math.sqrt(steps) : 0;

  return {
    optimalF: fCurve,
    userF: [...fCurve],
    expectedGrowthRate: parseFloat(meanLogGrowth.toFixed(5)),
    sharpeRatio: parseFloat(sharpe.toFixed(2)),
    probRuin: parseFloat((totalRuinCount / N).toFixed(4)),
    wealthPaths,
    pricePaths
  };
};


function computeNextPriceBrownian(params: {volatility: number}, currentPrice: number) {
  // Standard Normal sample (Box-Muller)
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  // Continuous Brownian increment
  let logReturn = (0 - 0.5 * Math.pow(params.volatility, 2)) + params.volatility * z;

  const newPrice = Math.max(0.01, currentPrice * Math.exp(logReturn));

  return newPrice
}

function computeNextPriceJumpDiffusion(params: {volatility: number}, currentPrice: number) {
  // TODO
  // Currently copied from brownian.
  // Standard Normal sample (Box-Muller)
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  // Continuous Brownian increment
  let logReturn = (0 - 0.5 * Math.pow(params.volatility, 2)) + params.volatility * z;

  const newPrice = Math.max(0.01, currentPrice * Math.exp(logReturn));

  return newPrice
}