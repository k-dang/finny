import { useEffect, useState } from "react";
import { STARTUP_INPUT_GUARD_MS } from "@/chat/tui/theme";

export function useComposerGuard(): boolean {
  const [composerArmed, setComposerArmed] = useState(false);

  useEffect(() => {
    // Give the terminal a moment to flush the launching command's buffered
    // keystrokes before the composer starts accepting input.
    const timer = setTimeout(() => {
      setComposerArmed(true);
    }, STARTUP_INPUT_GUARD_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return composerArmed;
}
