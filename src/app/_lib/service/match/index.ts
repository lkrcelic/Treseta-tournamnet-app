import { getMatchByIdWithResults } from "./getByIdWithResults";
import { createMatch } from "./create";
import { getActiveMatchByRoundId } from "./getActiveByRoundId";
import { finishMatch } from "./finish";
import { getAllMatchesByQuery } from "./getAllByQuery";

// Named exports
export { getMatchByIdWithResults, createMatch, getActiveMatchByRoundId, finishMatch, getAllMatchesByQuery };

// Default export as a service object
const matchService = {
  getMatchByIdWithResults,
  createMatch,
  getActiveMatchByRoundId,
  finishMatch,
  getAllMatchesByQuery,
};

export default matchService;
