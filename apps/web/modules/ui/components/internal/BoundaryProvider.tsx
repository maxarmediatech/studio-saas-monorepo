'use client';

import * as React from 'react';

export type BoundaryMode = 'off' | 'hydration' | 'rendering';

type BoundaryContextType = {
  mode: BoundaryMode;
  toggleMode: () => void;
  setMode: (mode: BoundaryMode) => void;
};

const BoundaryContext = React.createContext<BoundaryContextType | null>(null);

const BOUNDARY_MODE_KEY = 'boundaryMode';

export function BoundaryProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<BoundaryMode>('off');

  React.useEffect(() => {
    // Only run in development mode
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const savedMode = localStorage.getItem(BOUNDARY_MODE_KEY) as BoundaryMode;
    if (savedMode && ['off', 'rendering', 'hydration'].includes(savedMode)) {
      setMode(savedMode);
    }
  }, []);

  const toggleMode = () => {
    setMode(prev => {
      const newMode = prev === 'off' ? 'hydration' : prev === 'hydration' ? 'rendering' : 'off';
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOUNDARY_MODE_KEY, newMode);
      }
      return newMode;
    });
  };

  const updateMode = (newMode: BoundaryMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BOUNDARY_MODE_KEY, newMode);
    }
  };

  return (
    <BoundaryContext.Provider value={{ mode, setMode: updateMode, toggleMode }}>
      {children}
    </BoundaryContext.Provider>
  );
}

export function useBoundaryMode() {
  const context = React.useContext(BoundaryContext);
  if (!context) {
    throw new Error('useBoundaryMode must be used within a BoundaryProvider');
  }
  return context;
}
