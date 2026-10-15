import {color} from "@/app/_styles/tokens";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import {Box} from "@mui/material";

// The cream circle with the admin's shield at the top right of a table, its matches and who plays (admin-mobile
// 23–28): the admin is editing, not playing
export default function AdminBadge() {
  return (
    <Box
      component="span"
      role="img"
      aria-label="Admin"
      title="Admin"
      sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}
    >
      <AdminPanelSettingsRoundedIcon />
    </Box>
  );
}
