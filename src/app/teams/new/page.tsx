"use client"

import React, {useCallback, useState} from 'react';
import {Autocomplete, Box, Button, TextField} from '@mui/material';
import Image from "next/image";
import {createTeamAPI} from "@/app/_fetchers/team/create";
import {searchPlayersAPI} from "@/app/_fetchers/player/search";

export default function CreateTeam() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    team_name: '',
    founder_1: null,
    founder_2: null,
  });

  const fetchPlayers  = useCallback(async (value: string) => {
    if (value.length >= 2) {
      setLoading(true);
      const data = await searchPlayersAPI(value);
      setPlayers(Array.isArray(data) ? data : []);
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const {name, value} = e.target;
    setFormData({...formData, [name]: value});
  };

  const handleAutocompleteChange = (name, value) => {
    setFormData({...formData, [name]: value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createTeamAPI(formData.team_name, formData.founder_1.id, formData.founder_2.id);

    setFormData({
      team_name: '',
      founder_1: null,
      founder_2: null,
    });
  };

  const getFilteredPlayers = (players, excludePlayerId) => {
    return excludePlayerId ? players.filter(player => player.id !== excludePlayerId) : players;
  };

  return (
    <>
      <Box sx={{gridArea: "top", alignItems: "center", display: "flex", justifyContent: "center"}}>
        <Image src="/TitleBackground.png"
               alt="Logo"
               width={300}
               height={300}
               style={{width: '80%', height: 'auto', maxWidth: "600px"}}
        />
      </Box>
      <Box
        component="form"
        gridArea="body"
        onSubmit={handleSubmit}
      >
        <TextField
          name="team_name"
          placeholder="Enter Team Name"
          fullWidth
          value={formData.team_name}
          onChange={handleInputChange}
          sx={{
            bgcolor: 'secondary.main',
            borderRadius: '20px',
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px', // Ensures rounded corners
              padding: '6px 8px', // Controls overall padding
            },
            '& .MuiInputBase-input': {
              padding: '6px 8px', // Controls internal input padding
            },
          }}
          required
        />
        <Autocomplete
          options={getFilteredPlayers(players, formData?.founder_2?.id)}
          getOptionLabel={(option) => `${option.username} (${option.first_name} ${option.last_name})`}
          value={formData.founder_1}
          loading={loading}
          onInputChange={(e,value) => fetchPlayers(value)}
          onChange={(e, value) => handleAutocompleteChange('founder_1', value)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search Founder 1"
              fullWidth
              required
              sx={{
                bgcolor: 'secondary.main',
                borderRadius: '20px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px',
                  padding: '6px 12px',
                },
                '& .MuiInputBase-input': {
                  padding: '6px 12px',
                },
              }}
            />
          )}
          sx={{
            mt: 2,
            borderRadius: '20px',
          }}
        />
        <Autocomplete
          options={getFilteredPlayers(players, formData?.founder_1?.id)}
          getOptionLabel={(option) => `${option.username} (${option.first_name} ${option.last_name})`}
          value={formData.founder_2}
          loading={loading}
          onInputChange={(e,value) => fetchPlayers(value)}
          onChange={(e, value) => handleAutocompleteChange('founder_2', value)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search Founder 2"
              fullWidth
              required
              sx={{
                bgcolor: 'secondary.main',
                borderRadius: '20px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px', // Ensures rounded corners for Autocomplete
                  padding: '6px 12px', // Controls overall padding
                },
                '& .MuiInputBase-input': {
                  padding: '6px 12px', // Ensures consistent input padding
                },
              }}
            />
          )}
          sx={{
            mt: 2, // Add spacing between fields
            borderRadius: '20px',
          }}
        />
      </Box>
      <Box sx={{gridArea: "actions"}}>
        <Button
          onClick={(e) => handleSubmit(e)}
          variant="contained"
          color="primary"
          fullWidth
          sx={{mt: 2}}
        >
          Submit
        </Button>
      </Box>
    </>
  );
}
