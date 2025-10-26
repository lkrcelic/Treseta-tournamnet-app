import {Box, Button} from "@mui/material";
import React from "react";

type SingleActionButtonProps = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: "primary" | "secondary" | "error" | "info" | "success" | "warning";
  fullWidth?: boolean;
  disabled?: boolean;
}

export default function SingleActionButton({
                                             onClick,
                                             label,
                                             icon = null,
                                             color = "primary",
                                             fullWidth = false,
                                             disabled = false
                                           }: SingleActionButtonProps) {
  return (
    <Box sx={{width: fullWidth ? '100%' : 'auto'}}>
      <Button
        variant="contained"
        color={color}
        onClick={onClick}
        disabled={disabled}
        sx={{
          py: 1.5,
          px: 3,
          borderRadius: 2,
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 'medium',
          display: 'flex',
          gap: 1.5,
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '48px',
          boxShadow: 2,
          '&:active': {
            transform: 'scale(0.98)',
            boxShadow: 1,
          },
          transition: 'transform 0.1s, box-shadow 0.1s',
          ...(fullWidth && {width: '100%'})
        }}
      >
        {icon}
        {label}
      </Button>
    </Box>
  );
}