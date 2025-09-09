"use client";

import {getRoundDatesByLeagueIdAPI} from "@/app/_fetchers/league/getRoundDates";
import {getLeagueStandingsByDateAPI} from "@/app/_fetchers/league/getStandingsByDate";
import {getAllRoundsByQueryAPI} from "@/app/_fetchers/round/getAllByQuery";
import {RoundExtendedResponse} from "@/app/_interfaces/round";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import {LeagueStandingsItem} from "@/app/_ui/StandingsTable";
import {Home} from "@mui/icons-material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {Box, IconButton, Paper, Tab, Tabs, useMediaQuery, useTheme} from "@mui/material";
import {Grid} from "@mui/system";
import {useParams, useRouter, useSearchParams} from "next/navigation";
import React, {useEffect, useState} from "react";
import {a11yProps, PageHeader, RoundResultsPanel, StandingsTabContent, TabPanel} from "./ui";

// Group rounds by round number
type GroupedRounds = {
  [key: number]: RoundExtendedResponse[];
};

export default function DailyStandings() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [tabValue, setTabValue] = useState(0);
  const [leagueStandings, setLeagueStandings] = useState<LeagueStandingsItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [roundsByNumber, setRoundsByNumber] = useState<GroupedRounds>({});
  const [roundNumbers, setRoundNumbers] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const params = useParams<{leagueId: string}>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  // Format date for API query
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  };

  // Load all available dates first, decide initial selected date
  useEffect(() => {
    const loadDates = async () => {
      try {
        const leagueId = parseInt(params.leagueId);
        const dates = await getRoundDatesByLeagueIdAPI(leagueId);
        setAvailableDates(dates);

        const mostRecent = dates[dates.length - 1];
        const initial = dateParam && dates.includes(dateParam) ? dateParam : mostRecent || formatDate(new Date());
        setSelectedDate(initial);

        // Keep URL in sync without stacking history if it differs
        const urlParam = dateParam || "";
        if (initial && initial !== urlParam) {
          router.replace(`/league/${params.leagueId}/daily-standings?date=${initial}`);
        }
      } catch (e) {
        console.error("Failed to load available dates", e);
      }
    };
    loadDates();
  }, [params.leagueId]);

  // Shared fetcher that can optionally toggle loading state
  const fetchDataForDate = async (dateStr: string, withLoading = true) => {
    try {
      if (withLoading) setLoading(true);

      const leagueId = parseInt(params.leagueId);

      // Fetch standings
      const standingsData = await getLeagueStandingsByDateAPI(leagueId, dateStr);
      setLeagueStandings(standingsData);

      // Fetch rounds for the selected date and league_id
      const roundsData = await getAllRoundsByQueryAPI({
        round_date: dateStr,
        league_id: leagueId,
      });

      // Group rounds by round_number
      const grouped: GroupedRounds = {};
      roundsData.forEach((round) => {
        const roundNumber = round.round_number;
        if (!grouped[roundNumber]) {
          grouped[roundNumber] = [];
        }
        grouped[roundNumber].push(round);
      });

      setRoundsByNumber(grouped);

      // Extract and sort round numbers for tabs
      const numbers = Object.keys(grouped)
        .map(Number)
        .sort((a, b) => a - b);
      setRoundNumbers(numbers);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (withLoading) setLoading(false);
    }
  };

  // Fetch data when selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    fetchDataForDate(selectedDate, true);
  }, [params.leagueId, selectedDate]);

  // Auto-refresh every 30 seconds without toggling loading or changing UI layout
  useEffect(() => {
    if (!selectedDate) return;
    const intervalId = setInterval(() => {
      fetchDataForDate(selectedDate, false);
    }, 30000);
    return () => clearInterval(intervalId);
  }, [selectedDate, params.leagueId]);

  // Keep selectedDate in sync if URL date param changes and is valid
  useEffect(() => {
    if (!availableDates.length) return;
    if (dateParam && availableDates.includes(dateParam) && dateParam !== selectedDate) {
      setSelectedDate(dateParam);
    }
  }, [dateParam, availableDates]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Convert round data to match result format
  const mapRoundsToRoundResults = (rounds: RoundExtendedResponse[]) => {
    return rounds.map((round) => ({
      team1Name: round.team1?.team_name || `Team ${round.team1_id}`,
      team2Name: round.team2?.team_name || `Team ${round.team2_id}`,
      team1Wins: round.team1_wins,
      team2Wins: round.team2_wins,
      active: round.active || false,
      tableNumber: round.table_number || 0,
      matches: round.matches || [],
    }));
  };  

  // Format date for display (e.g., "17.02.2025")
  const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Navigation helpers
  const goToDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    router.push(`/league/${params.leagueId}/daily-standings?date=${dateStr}`);
  };

  const findPrevDate = (dateStr: string): string | null => {
    if (!availableDates.length) return null;
    const idx = availableDates.indexOf(dateStr);
    if (idx > 0) return availableDates[idx - 1];
    const earlier = availableDates.filter((d) => d < dateStr);
    return earlier.length ? earlier[earlier.length - 1] : null;
  };

  const findNextDate = (dateStr: string): string | null => {
    if (!availableDates.length) return null;
    const idx = availableDates.indexOf(dateStr);
    if (idx >= 0 && idx < availableDates.length - 1) return availableDates[idx + 1];
    const later = availableDates.find((d) => d > dateStr);
    return later ?? null;
  };

  const goPrevDay = () => {
    if (!selectedDate) return;
    const prev = findPrevDate(selectedDate);
    if (prev) goToDate(prev);
  };

  const goNextDay = () => {
    if (!selectedDate) return;
    const next = findNextDate(selectedDate);
    if (next) goToDate(next);
  };

  const hasPrev = !!(selectedDate && findPrevDate(selectedDate));
  const hasNext = !!(selectedDate && findNextDate(selectedDate));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 120px)",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <PageHeader
        title={`Okupljanje ${selectedDate ? formatDisplayDate(selectedDate) : ""}`}
        leftAction={
          <IconButton
            aria-label="Sljedeći datum s rundama"
            color="primary"
            size="large"
            onClick={goNextDay}
            disabled={!hasNext}
          >
            <ChevronLeftIcon />
          </IconButton>
        }
        rightAction={
          <IconButton
            aria-label="Prethodni datum s rundama"
            color="primary"
            size="large"
            onClick={goPrevDay}
            disabled={!hasPrev}
          >
            <ChevronRightIcon />
          </IconButton>
        }
      />

      {/* Main Content - Body Grid Area */}
      <Box
        sx={{
          gridArea: "body",
          width: "100%",
          height: "100%",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Paper
          elevation={2}
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%",
          }}
        >
          <Box sx={{borderBottom: 1, borderColor: "divider"}}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                backgroundColor: theme.palette.primary.main,
                overflowX: "auto",
                width: "100%",
                color: "white",
                "& .MuiTab-root": {
                  color: "rgba(255,255,255,0.7)",
                  fontWeight: "medium",
                  fontSize: {xs: "0.85rem", sm: "0.95rem"},
                  py: 2,
                },
                "& .Mui-selected": {
                  color: "inherit !important",
                  fontWeight: "bold",
                },
                "& .MuiTabs-indicator": {
                  backgroundColor: theme.palette.secondary.main,
                  height: 3,
                },
              }}
            >
              <Tab label="Tablica okupljanja" {...a11yProps(0)} />
              {roundNumbers.map((roundNumber, index) => (
                <Tab key={roundNumber} label={`Round ${roundNumber}`} {...a11yProps(index + 1)} />
              ))}
            </Tabs>
          </Box>

          <Box
            sx={{
              borderRadius: 2,
              backgroundColor: "background.paper",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              pt: 0.5,
              pb: 8,
            }}
          >
            <TabPanel value={tabValue} index={0}>
              <StandingsTabContent loading={loading} leagueStandings={leagueStandings} />
            </TabPanel>

            {roundNumbers.map((roundNumber, index) => (
              <TabPanel key={roundNumber} value={tabValue} index={index + 1}>
                <RoundResultsPanel
                  roundNumber={roundNumber}
                  rounds={mapRoundsToRoundResults(roundsByNumber[roundNumber] || [])}
                  activeRounds={roundsByNumber[roundNumber]?.filter((round) => round.active).length || 0}
                />
              </TabPanel>
            ))}
          </Box>
        </Paper>
      </Box>

      <Grid
        item
        size={{xs: 12}}
        sx={{
          gridArea: "actions",
          width: "100%",
          display: "flex",
          justifyContent: "center",
          mt: 2,
        }}
      >
        <SingleActionButton
          label={"Početni zaslon"}
          icon={<Home />}
          fullWidth={isMobile}
          onClick={() => router.push(`/`)}
        />
      </Grid>
    </Box>
  );
}
