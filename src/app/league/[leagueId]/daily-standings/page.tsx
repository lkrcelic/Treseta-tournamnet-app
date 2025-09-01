"use client";

import React, {useEffect, useState} from "react";
import {Box, Paper, Tab, Tabs, useMediaQuery, useTheme} from "@mui/material";
import {Grid} from "@mui/system";
import SingleActionButton from "@/app/_ui/SingleActionButton";
import {LeagueStandingsItem} from "@/app/_ui/StandingsTable";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {getLeagueStandingsByDateAPI} from "@/app/_fetchers/league/getStandingsByDate";
import {a11yProps, PageHeader, RoundResultsPanel, StandingsTabContent, TabPanel} from "./ui";
import {getRoundsAPI} from "@/app/_fetchers/round/getRounds";
import {RoundType} from "@/app/_interfaces/round";
import {useParams, useSearchParams} from "next/navigation";

// Group rounds by round number
type GroupedRounds = {
  [key: number]: RoundType[];
};

export default function DailyStandings() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [leagueStandings, setLeagueStandings] = useState<LeagueStandingsItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [roundsByNumber, setRoundsByNumber] = useState<GroupedRounds>({});
  const [roundNumbers, setRoundNumbers] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const params = useParams<{ leagueId: string }>();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');

  // Format date for API query
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  };

  useEffect(() => {
    // Set the selected date from URL parameter or default to current date
    const currentDate = dateParam || formatDate(new Date());
    setSelectedDate(currentDate);

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch standings
        const leagueId = parseInt(params.leagueId);
        const standingsData = await getLeagueStandingsByDateAPI(leagueId, currentDate);
        setLeagueStandings(standingsData);

        // Fetch rounds for the selected date and league_id
        const roundsData = await getRoundsAPI({
          round_date: currentDate,
          league_id: leagueId
        });

        // Group rounds by round_number
        const grouped: GroupedRounds = {};
        roundsData.forEach(round => {
          const roundNumber = round.round_number;
          if (!grouped[roundNumber]) {
            grouped[roundNumber] = [];
          }
          grouped[roundNumber].push(round);
        });

        setRoundsByNumber(grouped);

        // Extract and sort round numbers for tabs
        const numbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        setRoundNumbers(numbers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.leagueId, dateParam]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Convert round data to match result format
  const mapRoundsToMatchResults = (rounds: RoundType[]) => {
    return rounds.map(round => ({
      team1Name: round.team1?.team_name || `Team ${round.team1_id}`,
      team2Name: round.team2?.team_name || `Team ${round.team2_id}`,
      team1Score: round.team1_wins,
      team2Score: round.team2_wins,
      active: round.active || false,
      tableNumber: round.table_number || 0,
      ongoingMatches: round.ongoingMatches || [],
    }));
  };

  // Format date for display (e.g., "17.02.2025")
  const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 120px)',
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <PageHeader title={`Okupljanje ${formatDisplayDate(selectedDate)}`}/>

      {/* Main Content - Body Grid Area */}
      <Box sx={{
        gridArea: "body",
        width: "100%",
        height: '100%',
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <Paper
          elevation={2}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: "100%",
          }}
        >
          <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
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
                color: 'white',
                '& .MuiTab-root': {
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 'medium',
                  fontSize: {xs: '0.85rem', sm: '0.95rem'},
                  py: 2
                },
                '& .Mui-selected': {
                  color: 'inherit !important',
                  fontWeight: 'bold'
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: theme.palette.secondary.main,
                  height: 3
                }
              }}
            >
              <Tab label="Tablica okupljanja" {...a11yProps(0)} />
              {roundNumbers.map((roundNumber, index) => (
                <Tab key={roundNumber} label={`Round ${roundNumber}`} {...a11yProps(index + 1)} />
              ))}
            </Tabs>
          </Box>

          <Box sx={{
            borderRadius: 2,
            backgroundColor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            pt:0.5,
            pb: 8,
          }}>
            <TabPanel value={tabValue} index={0}>
              <StandingsTabContent loading={loading} leagueStandings={leagueStandings}/>
            </TabPanel>

            {roundNumbers.map((roundNumber, index) => (
              <TabPanel key={roundNumber} value={tabValue} index={index + 1}>
                <RoundResultsPanel
                  roundNumber={roundNumber}
                  matches={mapRoundsToMatchResults(roundsByNumber[roundNumber] || [])}
                  activeRounds={roundsByNumber[roundNumber]?.filter(round => round.active).length || 0}
                />
              </TabPanel>
            ))}
          </Box>
        </Paper>
      </Box>

      <Grid item size={{xs: 12}} sx={{
        gridArea: "actions",
        width: "100%",
        display: 'flex',
        justifyContent: 'center',
        mt: 2
      }}>
        <SingleActionButton
          fullWidth={isMobile}
          label={"Nazad"}
          onClick={() => window.history.back()}
          icon={<ArrowBackIcon/>}
        />
      </Grid>
    </Box>
  );
}
