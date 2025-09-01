"use client";

import {useCallback, useState} from "react";
import {resetAllStores} from "@/app/_utils/resetStores";
import {logoutUser} from "../_fetchers/authentication/logout";

export default function useLogout() {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(
    async (redirectTo: string = "/login") => {
      if (loggingOut) return;
      setLoggingOut(true);

      try {
        resetAllStores();

        await logoutUser();
        window.location.assign(redirectTo);
      } finally {
        setLoggingOut(false);
      }
    },
    [loggingOut]
  );

  return {logout, loggingOut};
}
