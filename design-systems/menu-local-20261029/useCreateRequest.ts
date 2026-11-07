import { useEffect, useRef } from 'react';
// Acknowledge after mounting so a click during a lazy page load is not lost.
// Clearing the request in the parent also prevents reopening it on a return visit.
export function useCreateRequest(request: number, onHandled: () => void, open: () => void) {
  const handled = useRef(0), latest = useRef({ open, onHandled }); latest.current = { open, onHandled };
  useEffect(() => {
    if (!request) { handled.current = 0; return; }
    if (handled.current === request) return;
    handled.current = request; latest.current.open(); latest.current.onHandled();
  }, [request]);
}
