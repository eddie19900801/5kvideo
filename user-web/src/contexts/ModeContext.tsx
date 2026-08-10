import { createContext, useContext, useState, useCallback } from 'react';

type AppMode = 'normal' | '18+';

const PIN_KEY = '5k_video_pin';
const MODE_KEY = '5k_video_mode';

interface ModeContextType {
  mode: AppMode;
  pinSet: boolean;
  setPin: (pin: string) => void;
  switchToNormal: () => void;
  switchTo18Plus: () => void;
  verifyPin: (pin: string) => boolean;
}

const ModeContext = createContext<ModeContextType | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppMode>(() => {
    const stored = localStorage.getItem(MODE_KEY);
    return stored === '18+' ? '18+' : 'normal';
  });

  const [pinSet, setPinSet] = useState(() => !!localStorage.getItem(PIN_KEY));

  const setPin = useCallback((pin: string) => {
    localStorage.setItem(PIN_KEY, pin);
    setPinSet(true);
  }, []);

  const switchToNormal = useCallback(() => {
    setMode('normal');
    localStorage.setItem(MODE_KEY, 'normal');
  }, []);

  const switchTo18Plus = useCallback(() => {
    setMode('18+');
    localStorage.setItem(MODE_KEY, '18+');
  }, []);

  const verifyPin = useCallback((pin: string) => {
    const stored = localStorage.getItem(PIN_KEY);
    return stored === pin;
  }, []);

  return (
    <ModeContext.Provider value={{ mode, pinSet, setPin, switchToNormal, switchTo18Plus, verifyPin }}>
      {children}
    </ModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
