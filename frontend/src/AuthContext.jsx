import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';
import api from './api';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUser();
  }, []);
  // Ask the browser for the current position (used for the office-only login)
  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('This browser does not support location access.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
        (err) =>
          reject(
            new Error(
              err.code === err.PERMISSION_DENIED
                ? 'Location access was blocked. Allow location for this site in your browser settings, then try again.'
                : 'Could not get your location. Please try again.'
            )
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  const login = async (email, password) => {
    // If location is unavailable we still send the login; the server decides
    // whether this user's role actually needs it (admins are exempt by default).
    let position = {};
    let positionError = null;
    try {
      position = await getPosition();
    } catch (err) {
      positionError = err;
    }
    let response;
    try {
      response = await api.post('/auth/login', {
        email,
        password,
        ...position
      });
    } catch (err) {
      if (err.response?.data?.code === 'LOCATION_REQUIRED' && positionError) {
        err.response.data.message = positionError.message;
      }
      throw err;
    }
    setUser(response.data.user);
    return response.data.user;
  };
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        fetchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  return useContext(AuthContext);
};
