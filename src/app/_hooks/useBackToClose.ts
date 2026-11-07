import {useEffect, useRef} from "react";
import {overlayHistory} from "@/app/_lib/overlayHistory";
import {cancelPop} from "@/app/_lib/navStack";

// The phone's Back closes this sheet or full-screen dialog while it is open (calls onClose), and only it; while busy
// (saving) Back leaves it open. How the history entries work: _lib/overlayHistory.ts.
export function useBackToClose(open: boolean, onClose: () => void, busy = false) {
  const latest = useRef({onClose, busy});
  latest.current = {onClose, busy};
  useEffect(() => {
    if (!open) return;
    // a Back that only closed an overlay stays on this page: the page stack (navStack) must not count it as a step back
    const history = overlayHistory((closed) => {
      if (closed) queueMicrotask(() => cancelPop(window.location.pathname));
    });
    const handle = history.opened(
      () => latest.current.onClose(),
      () => latest.current.busy
    );
    return () => history.closed(handle);
  }, [open]);
}
