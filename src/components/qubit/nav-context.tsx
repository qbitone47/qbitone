"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ScreenId, ScreenParams } from "@/lib/qubit/screens";

interface NavEntry {
  screen: ScreenId;
  params: ScreenParams;
  key: number;
}

interface QubitNavContextValue {
  screen: ScreenId;
  params: ScreenParams;
  navigate: (screen: ScreenId, params?: ScreenParams) => void;
  /** bump to force screens to re-read params (e.g. re-focus same screen) */
  navKey: number;
  /** history navigation (topbar back / forward) */
  canBack: boolean;
  canForward: boolean;
  back: () => void;
  forward: () => void;
}

const QubitNavContext = createContext<QubitNavContextValue | null>(null);

export function QubitNavProvider({ initialScreen, children }: { initialScreen: ScreenId; children: React.ReactNode }) {
  const [stack, setStack] = useState<NavEntry[]>([{ screen: initialScreen, params: {}, key: 0 }]);
  const [index, setIndex] = useState(0);

  const current = stack[index];

  const navigate = useCallback(
    (next: ScreenId, nextParams?: ScreenParams) => {
      const cur = stack[index];
      const sameTarget =
        cur && cur.screen === next && JSON.stringify(cur.params) === JSON.stringify(nextParams ?? {});
      if (sameTarget) {
        // re-focus same screen: bump key only, history position unchanged
        const bumped = { ...cur, key: cur.key + 1 };
        setStack([...stack.slice(0, index), bumped]);
      } else {
        // truncates any forward history, like a browser
        setStack([...stack.slice(0, index + 1), { screen: next, params: nextParams ?? {}, key: cur.key + 1 }]);
        setIndex(index + 1);
      }
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    },
    [stack, index],
  );

  const back = useCallback(() => {
    setIndex((i) => {
      if (i <= 0) return i;
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return i - 1;
    });
  }, []);

  const forward = useCallback(() => {
    setIndex((i) => {
      if (i >= stack.length - 1) return i;
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return i + 1;
    });
  }, [stack.length]);

  const value = useMemo(
    () => ({
      screen: current.screen,
      params: current.params,
      navigate,
      navKey: current.key,
      canBack: index > 0,
      canForward: index < stack.length - 1,
      back,
      forward,
    }),
    [current, navigate, index, stack.length, back, forward],
  );

  return <QubitNavContext.Provider value={value}>{children}</QubitNavContext.Provider>;
}

export function useQubitNav(): QubitNavContextValue {
  const ctx = useContext(QubitNavContext);
  if (!ctx) throw new Error("useQubitNav must be used inside QubitNavProvider");
  return ctx;
}
