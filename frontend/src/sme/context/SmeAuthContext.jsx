import { createContext, useContext, useEffect, useState } from 'react';
import { getSmeMe } from '../api/smeApi';

const SmeAuthContext = createContext(null);
const TOKEN_KEY = 'smeToken';

export function SmeAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [sme, setSme] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getSmeMe(token)
      .then((data) => !cancelled && setSme(data.sme))
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSme(null);
  };

  return (
    <SmeAuthContext.Provider value={{ sme, token, loading, logout, setSme }}>
      {children}
    </SmeAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSmeAuth = () => useContext(SmeAuthContext);
