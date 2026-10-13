"use client";

import {DirectoryLayout} from "@/app/_ui/profiles/Directory";
import React from "react";

// /players and /players/<id>: on the desktop an admin gets the Igrači directory next to the page (it stays as it is
// while the page beside it changes); everyone else the page alone
export default function PlayersLayout({children}: {children: React.ReactNode}) {
  return <DirectoryLayout kind="players">{children}</DirectoryLayout>;
}
