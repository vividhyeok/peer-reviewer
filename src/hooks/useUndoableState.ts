import { useState, useCallback } from 'react';

export function useUndoableState<T>(initialState: T) {
  const [state, setStateRaw] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const setState = useCallback((newStateOrUpdater: T | ((prev: T) => T)) => {
    setStateRaw(currentState => {
      const nextState = newStateOrUpdater instanceof Function 
        ? newStateOrUpdater(currentState) 
        : newStateOrUpdater;
      
      if (JSON.stringify(currentState) === JSON.stringify(nextState)) return currentState;

      setPast(prev => [...prev.slice(-49), currentState]); // Limit history to 50
      setFuture([]);
      return nextState;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(prev => {
      if (prev.length === 0) return prev;
      const newPast = prev.slice(0, -1);
      const previousState = prev[prev.length - 1];
      
      setStateRaw(currentState => {
        setFuture(f => [currentState, ...f]);
        return previousState;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const [nextState, ...newFuture] = prev;
      
      setStateRaw(currentState => {
         setPast(p => [...p, currentState]);
         return nextState;
      });
      return newFuture;
    });
  }, []);

  return { 
    state, 
    setState, 
    undo, 
    redo, 
    canUndo: past.length > 0, 
    canRedo: future.length > 0 
  };
}
