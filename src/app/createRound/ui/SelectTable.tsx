"use client";

import {useEffect, useState} from "react";
import {
  Button,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";

export interface TableEntry {
  id: number;
  name: string;
}

interface SelectTableProperties {
  onLoad: () => Promise<TableEntry[]>;
  onCreate: (teamIds: number[]) => void;
}

export default function SelectTable({onLoad, onCreate}: SelectTableProperties) {
  const [entries, setEntries] = useState<TableEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TableEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleToggleAll = (checked: boolean) => {
    setSelectAll(checked);

    // Update selectedIds based on all entries or filtered entries
    const entriesToToggle = searchTerm === "" ? entries : filteredEntries;

    if (checked) {
      // Add all IDs to the set
      const newSelectedIds = new Set(selectedIds);
      entriesToToggle.forEach(entry => newSelectedIds.add(entry.id));
      setSelectedIds(newSelectedIds);
    } else {
      // Remove all filtered IDs from the set
      const newSelectedIds = new Set(selectedIds);
      entriesToToggle.forEach(entry => newSelectedIds.delete(entry.id));
      setSelectedIds(newSelectedIds);
    }
  };

  const handleToggleSingle = (checked: boolean, entryId: number) => {
    const newSelectedIds = new Set(selectedIds);

    if (checked) {
      newSelectedIds.add(entryId);
    } else {
      newSelectedIds.delete(entryId);
    }

    setSelectedIds(newSelectedIds);

    // Update "Select All" based on whether all visible entries are selected
    if (searchTerm === "") {
      setSelectAll(entries.every(entry => newSelectedIds.has(entry.id)));
    } else {
      setSelectAll(filteredEntries.every(entry => newSelectedIds.has(entry.id)));
    }
  };

  const clickButton = () => {
    onCreate(Array.from(selectedIds));
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);

    // Filter entries based on search term
    const filtered = entries.filter((entry) => entry.name.toLowerCase().includes(term));
    setFilteredEntries(filtered);

    // Update selectAll state based on filtered entries
    if (filtered.length > 0) {
      setSelectAll(filtered.every(entry => selectedIds.has(entry.id)));
    } else {
      setSelectAll(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const data = await onLoad();
      setEntries(data);
      setFilteredEntries(data);

      // Initially select all teams
      const allIds = new Set(data.map(entry => entry.id));
      setSelectedIds(allIds);
      setSelectAll(true);
    };
    fetchData();
  }, []);

  return (
    <>
      <TextField
        label="Search"
        variant="outlined"
        fullWidth
        margin="normal"
        value={searchTerm}
        onChange={handleSearch}
      />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Present</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length > 0 && (
              <TableRow>
                <TableCell>
                  <b>Select all {searchTerm ? "filtered" : ""}</b>
                </TableCell>
                <TableCell align="right">
                  <Switch checked={selectAll} onChange={(event) => handleToggleAll(event.target.checked)}></Switch>
                </TableCell>
              </TableRow>
            )}

            {filteredEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.name}</TableCell>
                <TableCell align="right">
                  <Switch
                    checked={selectedIds.has(entry.id)}
                    onChange={(event) => handleToggleSingle(event.target.checked, entry.id)}
                  ></Switch>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button variant="contained" color="primary" onClick={clickButton}>
        Create round
      </Button>
    </>
  );
}
