import { getLeagueStandings } from "./getStandings";
import { getLeagueStandingsByDate } from "./getStandingsByDate";
import { getRoundDatesByLeagueId } from "./getRoundDatesById";

// Named exports
export { getLeagueStandings, getLeagueStandingsByDate, getRoundDatesByLeagueId };

// Default export as a service object
const leagueService = {
  getLeagueStandings,
  getLeagueStandingsByDate,
  getRoundDatesByLeagueId,
};

export default leagueService;
