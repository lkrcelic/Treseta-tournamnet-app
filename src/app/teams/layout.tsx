"use client";

import {DirectoryLayout} from "@/app/_ui/profiles/Directory";
import React from "react";

// /teams and /teams/<id>: on the desktop an admin gets the Ekipe directory next to the page (it stays as it is while
// the page beside it changes); everyone else the page alone
export default function TeamsLayout({children}: {children: React.ReactNode}) {
  return <DirectoryLayout kind="teams">{children}</DirectoryLayout>;
}
