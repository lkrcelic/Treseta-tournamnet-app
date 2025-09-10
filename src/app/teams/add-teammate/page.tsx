"use client";

import React, {useCallback, useState} from "react";
import {Autocomplete, Box, Button, TextField, Typography} from "@mui/material";
import Image from "next/image";
import {searchTeamsAPI} from "@/app/_fetchers/team/searchTeams";
import {searchPlayersAPI} from "@/app/_fetchers/player/search";
import {addTeammateAPI} from "@/app/_fetchers/team/addTeammate";
import type {TeamExtendedResponse} from "@/app/_interfaces/team";

export default function AddTeammate() {
  const [teams, setTeams] = useState<TeamExtendedResponse[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<{ team: TeamExtendedResponse | null; player: any | null }>({
    team: null,
    player: null,
  });

  const fetchTeams = useCallback(async (value: string) => {
    if (value.length >= 2) {
      setLoadingTeams(true);
      try {
        const data = await searchTeamsAPI(value);
        setTeams(Array.isArray(data) ? data : []);
      } finally {
        setLoadingTeams(false);
      }
    }
  }, []);

  const fetchPlayers = useCallback(async (value: string) => {
    if (value.length >= 2) {
      setLoadingPlayers(true);
      try {
        const data = await searchPlayersAPI(value);
        setPlayers(Array.isArray(data) ? data : []);
      } finally {
        setLoadingPlayers(false);
      }
    }
  }, []);

  const handleAutocompleteChange = (name: "team" | "player", value: any) => {
    setFormData(prev => ({...prev, [name]: value}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // guard against double submit
    if (!formData.team || !formData.player) return;

    try {
      setSubmitting(true);
      await addTeammateAPI(formData.team.team_id, formData.player.id);
      // reset
      setFormData({team: null, player: null});
    } catch (err) {
      console.error("Failed to add teammate", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Box component="form" gridArea="body" onSubmit={handleSubmit}>
        <Typography variant="subtitle1" sx={{mb: 1}}>
          Select team and player to add as a teammate
        </Typography>

        <Autocomplete
          options={teams}
          getOptionLabel={(option) => option.team_name}
          value={formData.team}
          loading={loadingTeams}
          onInputChange={(e, value) => fetchTeams(value)}
          onChange={(e, value) => handleAutocompleteChange("team", value)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search Team"
              fullWidth
              required
              sx={{
                bgcolor: "secondary.main",
                borderRadius: "20px",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "20px",
                  padding: "6px 12px",
                },
                "& .MuiInputBase-input": {
                  padding: "6px 12px",
                },
              }}
            />
          )}
          sx={{mt: 2, borderRadius: "20px"}}
        />

        <Autocomplete
          options={players}
          getOptionLabel={(option) => `${option.username} (${option.first_name} ${option.last_name})`}
          value={formData.player}
          loading={loadingPlayers}
          onInputChange={(e, value) => fetchPlayers(value)}
          onChange={(e, value) => handleAutocompleteChange("player", value)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search Player"
              fullWidth
              required
              sx={{
                bgcolor: "secondary.main",
                borderRadius: "20px",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "20px",
                  padding: "6px 12px",
                },
                "& .MuiInputBase-input": {
                  padding: "6px 12px",
                },
              }}
            />
          )}
          sx={{mt: 2, borderRadius: "20px"}}
        />
      </Box>

      <Box sx={{gridArea: "actions"}}>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          fullWidth
          disabled={submitting || !formData.team || !formData.player}
          sx={{mt: 2}}
        >
          {submitting ? "Adding..." : "Add Teammate"}
        </Button>
      </Box>
    </>
  );
}