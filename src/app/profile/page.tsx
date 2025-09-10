"use client";

import useAuthStore from "@/app/_store/authStore";
import theme from "@/app/_styles/theme";
import GroupsIcon from "@mui/icons-material/Groups";
import HomeIcon from "@mui/icons-material/Home";
import {Avatar, Box, CircularProgress, Paper, Stack, Typography, useMediaQuery, Container} from "@mui/material";
import {useRouter} from "next/navigation";
import React from "react";
import SingleActionButton from "../_ui/SingleActionButton";

// Basic types derived from existing interfaces
type Player = {
  id: number;
  username: string;
  email?: string;
  player_role?: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string | Date;
  created_at?: string | Date;
};

type TeamPlayer = {player: Player};

type Team = {
  team_id: number;
  team_name: string;
  teamPlayers: TeamPlayer[];
};

function formatDate(value?: string | Date): string | undefined {
  if (!value) return undefined;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("hr-HR", {day: "2-digit", month: "2-digit", year: "numeric"});
}

function DetailRow({label, value}: {label: string; value?: string}) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{fontWeight: 600}}>
        {value || "—"}
      </Typography>
    </Stack>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const {user} = useAuthStore();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = React.useState(true);
  const [player, setPlayer] = React.useState<Player | null>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);

  // Load player + teams
  React.useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [playerRes, teamsRes] = await Promise.all([fetch(`/api/players/${user.id}`), fetch(`/api/teams`)]);
        const playerJson = playerRes.ok ? await playerRes.json() : null;
        const teamsJson: Team[] = teamsRes.ok ? await teamsRes.json() : [];
        const myTeams = (teamsJson || []).filter((t) => t.teamPlayers?.some((tp) => tp.player?.id === user.id));
        setPlayer(playerJson);
        setTeams(myTeams);
      } catch (e) {
        // no-op: keep page usable
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  // No quick actions on profile per request

  const initials = React.useMemo(() => {
    const name = player?.username || "";
    const parts = name.split(" ");
    const inits = parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
    return inits || (player?.first_name?.[0]?.toUpperCase() ?? "U");
  }, [player]);

  return (
    <>
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
        {/* Header (sticky) */}
        <Box
          sx={{
            gridArea: "top",
            width: "100%",
            backgroundColor: "none",
            borderBottom: "1px solid rgba(0,0,0,0.1)",
            pb: 1,
            position: "sticky",
            zIndex: 10,
            top: 0,
          }}
        >
          <Container maxWidth="sm" sx={{p: 1}}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 2,
                backgroundColor: theme.palette.secondary.main,
                color: theme.palette.secondary.contrastText,
              }}
            >
              <Avatar sx={{bgcolor: theme.palette.primary.main, width: 56, height: 56}}>{initials}</Avatar>
              <Box sx={{flex: 1}}>
                <Typography variant="h6" sx={{fontWeight: "bold"}}>
                  {player?.username || "My Profile"}
                </Typography>
                {player?.first_name || player?.last_name ? (
                  <Typography variant="body2">
                    {player?.first_name} {player?.last_name}
                  </Typography>
                ) : null}
              </Box>
            </Paper>
          </Container>
        </Box>

        {/* Body (scrollable) */}
        <Box
          sx={{
            gridArea: "body",
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            py: 2,
          }}
        >
          <Container maxWidth="sm" sx={{display: "flex", flexDirection: "column", gap: 2, p: 1}}>
          {loading ? (
            <Box sx={{display: "flex", justifyContent: "center", alignItems: "center", height: "40vh"}}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2}>
              {/* Classic Details */}
              <Paper elevation={2} sx={{p: 2, borderRadius: 4}}>
                <Typography variant="subtitle1" sx={{mb: 1, fontWeight: 600}}>
                  Details
                </Typography>
                <Stack spacing={1.25}>
                  <DetailRow label="Username" value={player?.username} />
                  <DetailRow label="Email" value={player?.email} />
                  <DetailRow label="First name" value={player?.first_name} />
                  <DetailRow label="Last name" value={player?.last_name} />
                </Stack>
              </Paper>

              {/* My Teams */}
              <Paper elevation={2} sx={{p: 2, borderRadius: 4}}>
                <Typography variant="subtitle1" sx={{mb: 1, fontWeight: 600}}>
                  My Teams
                </Typography>
                {teams.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    You are not a member of any team yet.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {teams.map((team) => (
                      <Box
                        key={team.team_id}
                        sx={{
                          backgroundColor: theme.palette.secondary.main,
                          color: theme.palette.secondary.contrastText,
                          borderRadius: 3,
                          px: 2,
                          py: 1.5,
                        }}
                      >
                        <Typography variant="subtitle1" sx={{fontWeight: 600}}>
                          {team.team_name}
                        </Typography>
                        <Typography variant="caption" sx={{opacity: 0.9, display: "block"}}>
                          Teammates:
                        </Typography>
                        <Stack direction="column" spacing={0.5} sx={{mt: 0.5}}>
                          {team.teamPlayers?.map((tp, idx) => (
                            <Stack key={idx} direction="row" spacing={0.75} alignItems="center">
                              <GroupsIcon fontSize="small" />
                              <Typography variant="body2">{tp.player?.username}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          )}
          </Container>
        </Box>

        {/* Footer (sticky) */}
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
            <SingleActionButton
              label={"Početni zaslon"}
              icon={<HomeIcon />}
              fullWidth={isMobile}
              onClick={() => router.push(`/`)}
            />
          </Container>
        </Box>
      </Box>
    </>
  );
}