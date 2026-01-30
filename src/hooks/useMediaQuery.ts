import { useState, useEffect } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    // Check purely for server-side rendering safety, though this is client-side app
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    // Ensure window is defined before accessing matchMedia
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(query);

    // Update state if the initial match status is different from the current state
    // This handles cases where the query might change or the component mounts
    // and the initial state set by useState's lazy initializer is outdated
    // before the listener has a chance to fire.
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [query]); // Only re-run effect if the query changes

  return matches;
}
