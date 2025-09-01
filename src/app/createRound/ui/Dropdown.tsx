"use client";

import React, {useEffect, useState} from "react";
import {Button, MenuItem, Select, SelectChangeEvent} from "@mui/material";

export interface DropdownOption {
  id: number;
  name: string;
}

interface DropdownProperties {
  onSelect: (selectedValue: number) => void;
  getOptions: () => Promise<DropdownOption[]>;
}

export default function Dropdown({onSelect, getOptions}: DropdownProperties) {
  const [options, setLeagues] = useState<DropdownOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<DropdownOption | null>(null);

  function createRound() {
    if (selectedOption) onSelect(selectedOption.id);
  }

  useEffect(() => {
    const fetchOptions = async () => {
      const data = await getOptions();
      setLeagues(data);
    };
    fetchOptions();
  }, []);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const selectedLeague = options.find((opt) => opt.id === parseInt(event.target.value));
    if (selectedLeague) {
      setSelectedOption(selectedLeague);
    }
  };

  return (
    <>
      <Select value={selectedOption?.id.toString() || ""} onChange={handleChange} displayEmpty fullWidth>
        <MenuItem value="" disabled>
          Select option
        </MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))}
      </Select>
      <Button variant="contained" color="primary" onClick={createRound}>
        Select
      </Button>
    </>
  );
}
