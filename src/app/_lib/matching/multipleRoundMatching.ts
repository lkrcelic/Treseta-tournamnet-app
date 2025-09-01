export interface Team {
  readonly id: number;
  readonly name: string;
  readonly point_difference: number;
  readonly score: number;
  modified_score?: number | null | undefined;
  played_against: number[]; // ids of teams already played against!
  current_execution_played_against?: number[]; // teams played against in this execution
}

export interface TeamPair {
  teamOne: Team;
  teamTwo: Team;
}

export interface MultiRoundMatchingOptions {
  windowSize: number;
  numberOfRounds: number;
}

/**
 * Creates a bye team
 */
function createByeTeam(): Team {
  return {
    id: parseInt(process.env.BYE_ID ?? "0"), 
    name: "bye", 
    score: 0, 
    point_difference: 0,
    played_against: []
  };
}

/**
 * Divides teams into windows based on score and window size
 */
function divideTeamsIntoWindows(teams: Team[], windowSize: number, numberOfRounds: number): Team[][] {
  const sortedTeams = [...teams].sort((a, b) =>
    a.score === b.score ? b.point_difference - a.point_difference : b.score - a.score
  );
  
  const windows: Team[][] = [];
  for (let i = 0; i < sortedTeams.length; i += windowSize) {
    windows.push(sortedTeams.slice(i, i + windowSize));
  }
  
  // Add a bye team to the last window if it has an odd size
  if (windows.length > 0 && windows[windows.length - 1].length % 2 !== 0) {
    windows[windows.length - 1].push(createByeTeam());
  }
  
  // Handle the last window if it's smaller than the window size
  if (windows.length > 1 && windows[windows.length - 1].length < Math.max(windowSize / 2, numberOfRounds)) {
    const lastWindow = windows.pop();
    if (lastWindow) {
      windows[windows.length - 1] = [...windows[windows.length - 1], ...lastWindow];
    }
  }
  
  return windows;
}

/**
 * Counts how many times two teams have played against each other
 */
function countMatchups(teamA: Team, teamB: Team): number {
  let count = 0;
  for (const id of teamA.played_against) {
    if (id === teamB.id) count++;
  }
  return count;
}

/**
 * Calculates a cost matrix for all possible pairings in a window
 * Only calculates half of the matrix since it's symmetric and copies values to the other half
 */
function calculateCostMatrix(teams: Team[]): number[][] {
  const n = teams.length;
  const costMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    costMatrix[i][i] = Infinity;
  }
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const matchupCount = countMatchups(teams[i], teams[j]);
      costMatrix[i][j] = matchupCount;
      costMatrix[j][i] = matchupCount;
    }
  }
  
  return costMatrix;
}

/**
 * Generates all possible round-robin rounds for a given set of teams
 * For n teams, generates n-1 rounds of pairings
 * Handles odd number of teams by adding a bye team
 */
function generateRoundRobinRounds(teams: Team[]): TeamPair[][] {
  const teamsToUse = [...teams];
  
  const n = teamsToUse.length;
  const rounds: TeamPair[][] = [];
  
  for (let round = 0; round < n - 1; round++) {
    const pairs: TeamPair[] = [];
    
    for (let i = 0; i < n / 2; i++) {
      const team1 = teamsToUse[i];
      const team2 = teamsToUse[n - 1 - i];
      pairs.push({ teamOne: team1, teamTwo: team2 });
    }
    
    rounds.push(pairs);
    
    const lastTeam = teamsToUse[n - 1];
    for (let i = n - 1; i > 1; i--) {
      teamsToUse[i] = teamsToUse[i - 1];
    }
    teamsToUse[1] = lastTeam;
  }
  
  return rounds;
}

/**
 * Calculates the total cost of a round based on the cost matrix
 */
function calculateRoundCost(round: TeamPair[], teams: Team[], costMatrix: number[][]): number {
  let totalCost = 0;
  
  for (const pair of round) {
    const team1Index = teams.findIndex(t => t.id === pair.teamOne.id);
    const team2Index = teams.findIndex(t => t.id === pair.teamTwo.id);
    
    totalCost += costMatrix[team1Index][team2Index];
  }
  
  return totalCost;
}

/**
 * Generates pairings for multiple rounds
 */
export function generateMultipleRoundPairings(
  teams: Team[], 
  options: MultiRoundMatchingOptions
): TeamPair[][] {
  const { windowSize, numberOfRounds } = options;
  const allRoundPairings: TeamPair[][] = [];

  // Validate inputs
  if (teams.length === 0) {
    return [];
  }

  if (numberOfRounds >= windowSize) {
    throw new Error("Invalid arguments, number of rounds can't be bigger or equal than window size!")
  }
  
  const windows = divideTeamsIntoWindows(teams, windowSize, numberOfRounds);
  const windowRoundsWithCosts: { window: Team[], roundsWithCosts: {round: TeamPair[], cost: number}[] }[] = [];
  
  for (const window of windows) {
    const allRounds = generateRoundRobinRounds(window);
    const costMatrix = calculateCostMatrix(window);
    
    const roundsWithCosts = allRounds.map(round => ({
      round,
      cost: calculateRoundCost(round, window, costMatrix)
    }));
    
    roundsWithCosts.sort((a, b) => a.cost - b.cost);
    windowRoundsWithCosts.push({ window, roundsWithCosts });
  }
  
  // For each round, select the lowest cost round for each window
  for (let roundIndex = 0; roundIndex < numberOfRounds; roundIndex++) {
    const roundPairings: TeamPair[] = [];
    
    for (const { roundsWithCosts } of windowRoundsWithCosts) {      
      const bestRound = roundsWithCosts.shift().round;
      roundPairings.push(...bestRound);     
    }
    
    // Move bye pair to the end
    const byeIndex = roundPairings.findIndex(pair => 
      pair.teamOne.name.toLowerCase() === 'bye' || pair.teamTwo.name.toLowerCase() === 'bye'
    );
    if (byeIndex !== -1) {
      const byePair = roundPairings.splice(byeIndex, 1)[0];
      roundPairings.push(byePair);
    }
    
    allRoundPairings.push(roundPairings);
  }
  
  return allRoundPairings;
}

/**
 * Legacy function for backward compatibility
 * Matches teams for a single round
 */
export function matchTeams(teams: Team[]): TeamPair[] {
  // Use the new system with default values
  const options: MultiRoundMatchingOptions = {
    windowSize: Math.max(Math.floor(teams.length / 8), 2),
    numberOfRounds: 1
  };
  
  const allRoundPairings = generateMultipleRoundPairings(teams, options);
  return allRoundPairings[0] || [];
}
