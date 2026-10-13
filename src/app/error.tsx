"use client";

import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {PAGE_ERROR, PageMessage} from "@/app/_ui/sp/PageMessage";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";

// A page that broke while it was shown (instead of Next's English "Application error"): Pokušaj ponovno renders it
// again, Početni zaslon leaves it. The root layout stays, so app/global-error is only for the layout itself.
export default function ErrorPage({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const router = useTransitionRouter();
  return <PageMessage icon={<ErrorOutlineRoundedIcon />} title={PAGE_ERROR.title} text={PAGE_ERROR.text} onRetry={reset} onHome={() => router.push("/", "back")} />;
}
