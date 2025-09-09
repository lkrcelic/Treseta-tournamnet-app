import { activateRound } from "./activateRound";
import { finishRound } from "./finish";
import { getRoundById } from "./getById";
import { getLastOpenRoundByPlayerId } from "./getLastOpenByPlayerId";
import { getCurrentRoundMatchups, getRoundMatchups } from "./getRoundMatchups";
import { createByeMatches, insertPairRounds } from "./insertPairRounds";
import { updateRoundWins } from "./updateWins";

// Named exports
export {
  activateRound, createByeMatches, finishRound, getCurrentRoundMatchups, getLastOpenRoundByPlayerId, getRoundById, getRoundMatchups, insertPairRounds, updateRoundWins
};

// Default export as a service object
const roundService = {
  finishRound,
  getRoundById,
  getLastOpenRoundByPlayerId,
  getRoundMatchups,
  getCurrentRoundMatchups,
  insertPairRounds,
  createByeMatches,
  updateRoundWins,
  activateRound,
};

export default roundService;
