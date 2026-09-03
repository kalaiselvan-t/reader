import { useCallback, useEffect, useRef } from 'react';

interface PressHoldHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

function isFormElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/**
 * Press-and-hold "dead-man's switch": onStart fires when a hold begins
 * (pointer down or Space keydown), onStop when it ends (pointer up/leave/cancel
 * or Space keyup). onStart fires exactly once per hold even with key repeat.
 */
export function usePressHold(
  onStart: () => void,
  onStop: () => void,
  opts?: { useSpace?: boolean }
): PressHoldHandlers {
  const holding = useRef(false);
  const startRef = useRef(onStart);
  const stopRef = useRef(onStop);
  startRef.current = onStart;
  stopRef.current = onStop;

  const start = useCallback(() => {
    if (holding.current) return;
    holding.current = true;
    startRef.current();
  }, []);

  const stop = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    stopRef.current();
  }, []);

  useEffect(() => {
    if (opts?.useSpace === false) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isFormElement(e.target)) {
        e.preventDefault();
        start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFormElement(e.target)) {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [start, stop, opts?.useSpace]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}
