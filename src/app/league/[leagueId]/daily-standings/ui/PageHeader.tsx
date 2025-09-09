import React from "react";
import { Box, Divider, Typography } from "@mui/material";

type PageHeaderProps = {
  title: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
};

export function PageHeader({ title, leftAction, rightAction }: PageHeaderProps) {
  return (
    <Box sx={{
      gridArea: "top",
      width: "100%",
      backgroundColor: 'none',
      borderBottom: '1px solid rgba(0,0,0,0.1)',
      pb: 2,
      position: 'sticky',
      zIndex: 10
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1
      }}>
        <Box sx={{ width: 56, display: 'flex', justifyContent: 'flex-start' }}>
          {leftAction}
        </Box>
        <Typography variant="h5" component="h1" sx={{
          fontWeight: 'bold',
          textAlign: 'center',
          color: 'primary.main',
          pb: 1
        }}>
          {title}
        </Typography>
        <Box sx={{ width: 56, display: 'flex', justifyContent: 'flex-end' }}>
          {rightAction}
        </Box>
      </Box>
      <Divider />
    </Box>
  );
}
