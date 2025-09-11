"use client";

import useLogout from "@/app/_hooks/useLogout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LogoutIcon from "@mui/icons-material/Logout";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Box, Button, CircularProgress, Container, IconButton, Paper, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveOrCreateMatchByPlayerIdAPI } from "./_fetchers/match/getActiveOrCreateByPlayerIdAPI";

const ActionButton = ({
  onClick,
  label,
  color = "primary",
  fullWidth = true,
  icon = null,
  disabled = false,
  loading = false,
}) => (
  <Button
    variant="contained"
    color={color}
    onClick={onClick}
    fullWidth={fullWidth}
    disabled={disabled || loading}
    sx={{
      py: 1.8,
      px: 3,
      borderRadius: 2.5,
      textTransform: "none",
      fontSize: "1.05rem",
      fontWeight: "medium",
      display: "flex",
      gap: 1.5,
      justifyContent: "center",
      alignItems: "center",
      minHeight: "54px",
      boxShadow: 2,
      "&:active": {
        transform: "scale(0.98)",
        boxShadow: 1,
      },
      transition: "transform 0.1s, box-shadow 0.1s",
    }}
  >
    {loading ? <CircularProgress size={20} color="inherit" /> : icon}
    {label}
  </Button>
);

export default function Home() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const {logout, loggingOut} = useLogout();
  const [startingGame, setStartingGame] = useState(false);

  // Check if user is admin
  useEffect(() => {
    fetch("/api/session/is-admin")
      .then((res) => res.json())
      .then((data) => setIsAdmin(data))
      .catch((err) => console.error("Failed to fetch session", err));
  }, []);

  // Navigation handlers
  const handleStartGame = async () => {
    try {
      setStartingGame(true);

      const {id: activeMatchId} = await getActiveOrCreateMatchByPlayerIdAPI();
      router.push(`/match/${activeMatchId}`);

    } catch (error) {
      setStartingGame(false);
    }
  };

  const navigateTo = (path) => () => {
    router.push(path);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 90px)",
        width: "100%",
        position: "relative",
        overflowY: "hidden",
      }}
    >
      {/* Fixed Header - Top Grid Area */}
      <Box
        sx={{
          gridArea: "top",
          width: "100%",
          backgroundColor: "none",
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          pb: 2,
          position: "sticky",
          zIndex: 10,
        }}
      >
        <Container maxWidth="sm" sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          <Typography variant="h5" component="h1" sx={{fontWeight: "bold", textAlign: "center", color: "primary.main"}}>
            Trešeta Liga
          </Typography>
          <IconButton color="primary" aria-label="My Profile" onClick={navigateTo("/profile")}>
            <AccountCircleIcon />
          </IconButton>
        </Container>
      </Box>

      <Box
        sx={{
          gridArea: "body",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          py: 2,
        }}
      >
        <Container
          maxWidth="sm"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            p: 1,
            width: "100%",
          }}
        >
          {/* Main Actions Section */}
          <Paper
            elevation={3}
            sx={{
              p: 3,
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            <Typography variant="h6" component="h2" sx={{mb: 1, fontWeight: "bold", textAlign: "center"}}>
              Tournament Actions
            </Typography>

            <ActionButton
              onClick={handleStartGame}
              label="Start Game"
              color="primary"
              icon={<PlayArrowIcon />}
              disabled={startingGame}
              loading={startingGame}
            />

            <ActionButton
              onClick={navigateTo("/league/1/daily-standings")}
              label="Daily Standings"
              color="primary"
              icon={<CalendarMonthIcon />}
            />

            <ActionButton
              onClick={navigateTo("/league/1/standings")}
              label="League Standings"
              color="primary"
              icon={<EmojiEventsIcon />}
            />
          </Paper>

          {/* Admin Section - Only visible to admins */}
          {isAdmin && (
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              }}
            >
              <Typography variant="h6" component="h2" sx={{mb: 1, fontWeight: "bold", textAlign: "center"}}>
                Admin Controls
              </Typography>

              <ActionButton
                onClick={navigateTo("/createRound")}
                label="Create Round"
                color="secondary"
                fullWidth
                icon={<AddCircleOutlineIcon />}
              />

              <ActionButton
                onClick={navigateTo("/teams/new")}
                label="Create Team"
                color="secondary"
                fullWidth
                icon={<GroupAddIcon />}
              />
              <ActionButton
                onClick={navigateTo("/teams/add-teammate")}
                label="Add Teammate"
                color="secondary"
                fullWidth
                icon={<GroupAddIcon />}
              />
            </Paper>
          )}
        </Container>
      </Box>

      {/* Fixed Footer - Actions Grid Area */}
      <Box
        sx={{
          gridArea: "actions",
          width: "100%",
          backgroundColor: "none",
          borderTop: "1px solid rgba(0,0,0,0.1)",
          py: 2,
          position: "sticky",
          bottom: 0,
          zIndex: 10,
        }}
      >
        <Container maxWidth="sm" sx={{display: "flex", justifyContent: "center", p: 1}}>
          <ActionButton
            onClick={() => logout()}
            label="Log Out"
            color="secondary"
            icon={<LogoutIcon />}
            disabled={loggingOut}
          />
        </Container>
      </Box>
    </Box>
  );
}
