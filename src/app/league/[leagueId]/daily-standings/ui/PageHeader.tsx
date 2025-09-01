import React from "react";
import { Box, Divider, Typography } from "@mui/material";

type PageHeaderProps = {
  title: string;
};

export function PageHeader({ title }: PageHeaderProps) {
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
      <Typography variant="h5" component="h1" sx={{
        fontWeight: 'bold',
        textAlign: 'center',
        color: 'primary.main',
        pb: 1
      }}>
        {title}
      </Typography>
      <Divider />
    </Box>
  );
}
