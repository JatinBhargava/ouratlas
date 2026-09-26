import { useCallback, useState } from "react";

/**
 * Undo and redo for one value, with a way to change it without a step.
 *
 * A drag produces a new value on every pointer move. Recording each would
 * make undo walk a box back a pixel at a time, so a drag calls `checkpoint`
 * once when it starts and `preview` as it moves: the whole gesture undoes in
 * one step, to where it began. Everything else calls `commit`, which is a
 * checkpoint and a change together.
 */
const LIMIT = 100;

type State<T> = { past: T[]; present: T; future: T[] };

export function useHistory<T>(initial: () => T) {
  const [state, setState] = useState<State<T>>(() => ({ past: [], present: initial(), future: [] }));

  const commit = useCallback((next: T | ((current: T) => T)) => {
    setState(({ past, present }) => {
      const value = typeof next === "function" ? (next as (current: T) => T)(present) : next;
      if (value === present) return { past, present, future: [] };
      return { past: [...past, present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  const checkpoint = useCallback(() => {
    setState(({ past, present }) => ({ past: [...past, present].slice(-LIMIT), present, future: [] }));
  }, []);

  const preview = useCallback((next: T | ((current: T) => T)) => {
    setState(state => ({
      ...state,
      present: typeof next === "function" ? (next as (current: T) => T)(state.present) : next,
    }));
  }, []);

  const undo = useCallback(() => {
    setState(({ past, present, future }) =>
      past.length === 0 ? { past, present, future } : { past: past.slice(0, -1), present: past[past.length - 1]!, future: [present, ...future] },
    );
  }, []);

  const redo = useCallback(() => {
    setState(({ past, present, future }) =>
      future.length === 0 ? { past, present, future } : { past: [...past, present], present: future[0]!, future: future.slice(1) },
    );
  }, []);

  /** Starts over from `value` with no history: a restored draft or a layout from the directory is a new beginning, not a step. */
  const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);

  return {
    value: state.present,
    reset,
    commit,
    checkpoint,
    preview,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
