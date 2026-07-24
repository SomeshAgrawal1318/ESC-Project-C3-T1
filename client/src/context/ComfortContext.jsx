// Reading-comfort setting: one boolean, shared app-wide, persisted per
// browser. When on, it writes data-comfort="on" onto <html>; index.css does
// the rest (warm paper tint, taller line height, wider tracking) with no
// component re-layout. The wireframe scopes this to the shell sidebar so it
// is reachable from every screen.

import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'lexipath.comfort';
const ComfortContext = createContext(null);

export function ComfortProvider({ children }) {
  const [comfort, setComfort] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'on',
  );

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-comfort',
      comfort ? 'on' : 'off',
    );
    localStorage.setItem(STORAGE_KEY, comfort ? 'on' : 'off');
  }, [comfort]);

  const toggle = () => setComfort((v) => !v);

  return (
    <ComfortContext.Provider value={{ comfort, toggle }}>
      {children}
    </ComfortContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook ships with its provider
export function useComfort() {
  const ctx = useContext(ComfortContext);
  if (!ctx) throw new Error('useComfort must be used within ComfortProvider');
  return ctx;
}
