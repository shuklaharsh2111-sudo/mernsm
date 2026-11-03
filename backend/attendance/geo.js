// Office geofence helpers. Configure the office in backend/.env:
//   OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS_METERS (default 200)
//   ATTENDANCE_ENFORCE=true        -> SMEs can only log in from the office
//   ATTENDANCE_ENFORCE_ADMIN=false -> set true to also lock admins to the office

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
};

export const getOfficeConfig = () => {
  const lat = parseFloat(process.env.OFFICE_LAT);
  const lng = parseFloat(process.env.OFFICE_LNG);
  const radius = parseFloat(process.env.OFFICE_RADIUS_METERS) || 200;
  return {
    configured: Number.isFinite(lat) && Number.isFinite(lng),
    lat,
    lng,
    radius,
    enforceSme: process.env.ATTENDANCE_ENFORCE !== 'false',
    enforceAdmin: process.env.ATTENDANCE_ENFORCE_ADMIN === 'true'
  };
};

const validCoords = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Returns { ok, status, message, location }.
 * `location` is what gets stored on the attendance record (or null).
 */
export const checkLocation = (role, body = {}) => {
  const office = getOfficeConfig();
  const enforce = role === 'admin' ? office.enforceAdmin : office.enforceSme;

  const lat = parseFloat(body.latitude);
  const lng = parseFloat(body.longitude);
  const accuracy = parseFloat(body.accuracy);
  const hasCoords = validCoords(lat, lng);

  let location = null;
  if (hasCoords && office.configured) {
    location = {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : undefined,
      distance: Math.round(distanceMeters(lat, lng, office.lat, office.lng))
    };
  } else if (hasCoords) {
    location = { lat, lng, accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : undefined };
  }

  if (!enforce) return { ok: true, location };

  if (!office.configured) {
    return {
      ok: false,
      status: 503,
      message: 'Office location is not configured yet. Please contact the admin.'
    };
  }
  if (!hasCoords) {
    return {
      ok: false,
      status: 403,
      code: 'LOCATION_REQUIRED',
      message: 'Location access is required to log in. Please allow location in your browser and try again.'
    };
  }
  if (location.distance > office.radius) {
    return {
      ok: false,
      status: 403,
      code: 'OUTSIDE_OFFICE',
      message: `You can only log in from the office. You are about ${location.distance} m away (allowed: ${office.radius} m).`
    };
  }
  return { ok: true, location };
};
