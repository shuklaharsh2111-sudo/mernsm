import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import os from 'os';
import { protect } from '../auth.js';
import { distanceMeters, getOfficeConfig } from './geo.js';
import Location from './Location.js';
import Device from './Device.js';
import DeviceVisit from './DeviceVisit.js';
import { roleModels } from '../admin/UserModels.js';

// A device that stops reporting is treated as having left, at the last time it was seen.
const STALE_MS = (parseFloat(process.env.DEVICE_STALE_MINUTES) || 10) * 60 * 1000;

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const num = (v) => (v === '' || v == null ? NaN : Number(v));
const validCoords = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const locationView = (l) => ({
  id: String(l._id), name: l.name, code: l.code, lat: l.lat, lng: l.lng, radius: l.radius, active: l.active, isOffice: Boolean(l.isOffice)
});
const deviceView = (d, locName) => ({
  id: String(d._id),
  name: d.name,
  type: d.type,
  ownerName: d.ownerName,
  ownerId: d.ownerId ? String(d.ownerId) : null,
  ownerRole: d.ownerRole,
  active: d.active,
  deviceKey: d.deviceKey,
  lastSeenAt: d.lastSeenAt,
  currentLocationId: d.currentLocationId ? String(d.currentLocationId) : null,
  currentLocation: locName || null
});

// Close visits whose device went silent. outAt = the last time we heard from it.
const closeStaleVisits = async () => {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await DeviceVisit.find({ outAt: null, lastSeenAt: { $lt: cutoff } }).select('_id deviceId lastSeenAt').lean();
  if (!stale.length) return;
  await Promise.all(stale.map((v) => DeviceVisit.updateOne({ _id: v._id, outAt: null }, { $set: { outAt: v.lastSeenAt } })));
  const ids = [...new Set(stale.map((v) => String(v.deviceId)))];
  for (const id of ids) {
    const stillOpen = await DeviceVisit.exists({ deviceId: id, outAt: null });
    if (!stillOpen) await Device.updateOne({ _id: id }, { $set: { currentLocationId: null } });
  }
};

// Core rule: enter a location -> new visit with inAt. Leave / go somewhere else -> outAt is set.
const applyPosition = async (device, location, now, source) => {
  const open = await DeviceVisit.findOne({ deviceId: device._id, outAt: null }).sort({ inAt: -1 });

  if (location) {
    if (open && String(open.locationId) === String(location._id)) {
      open.lastSeenAt = now;
      await open.save();
    } else {
      if (open) { open.outAt = now; await open.save(); }
      await DeviceVisit.create({ deviceId: device._id, locationId: location._id, inAt: now, lastSeenAt: now, source });
    }
    device.currentLocationId = location._id;
  } else {
    if (open) { open.outAt = now; await open.save(); }
    device.currentLocationId = null;
  }
  device.lastSeenAt = now;
  await device.save();
};

// ============ PUBLIC (the device itself, identified by its secret key) ============
export const publicRouter = express.Router();

const findDevice = async (req) => {
  const key = String(req.get('x-device-key') || req.body?.key || '').trim();
  if (!key) return null;
  return Device.findOne({ deviceKey: key });
};

// Device reports its coordinates. Body: { key, latitude, longitude, accuracy? }
publicRouter.post('/ping', async (req, res) => {
  try {
    const device = await findDevice(req);
    if (!device) return res.status(401).json({ message: 'Unknown device. Ask the admin to register it.' });
    if (!device.active) return res.status(403).json({ message: 'This device has been disabled.' });

    const lat = num(req.body.latitude);
    const lng = num(req.body.longitude);
    if (!validCoords(lat, lng)) return res.status(400).json({ message: 'Valid latitude and longitude are required.' });

    const locations = await Location.find({ active: true }).lean();
    let hit = null;
    for (const l of locations) {
      const d = distanceMeters(lat, lng, l.lat, l.lng);
      if (d <= l.radius && (!hit || d < hit.distance)) hit = { loc: l, distance: d };
    }

    await closeStaleVisits();
    device.lastLat = lat;
    device.lastLng = lng;
    const wasIn = device.currentLocationId ? String(device.currentLocationId) : null;
    await applyPosition(device, hit?.loc || null, new Date(), 'gps');
    const nowIn = hit ? String(hit.loc._id) : null;

    res.json({
      inside: Boolean(hit),
      location: hit ? hit.loc.name : null,
      distance: hit ? Math.round(hit.distance) : null,
      event: wasIn === nowIn ? 'none' : nowIn ? 'entered' : 'left'
    });
  } catch (e) {
    console.error('device ping', e);
    res.status(500).json({ message: 'Could not record position' });
  }
});

// For gate readers / beacons that know the place without GPS. Body: { key, code, type: 'in' | 'out' }
publicRouter.post('/event', async (req, res) => {
  try {
    const device = await findDevice(req);
    if (!device) return res.status(401).json({ message: 'Unknown device.' });
    if (!device.active) return res.status(403).json({ message: 'This device has been disabled.' });
    const type = req.body.type === 'out' ? 'out' : 'in';
    const location = await Location.findOne({ code: String(req.body.code || '').trim().toUpperCase(), active: true });
    if (!location) return res.status(404).json({ message: 'Unknown location code.' });
    await applyPosition(device, type === 'in' ? location : null, new Date(), 'reader');
    res.json({ message: type === 'in' ? `In-time recorded at ${location.name}` : 'Out-time recorded', type });
  } catch (e) {
    console.error('device event', e);
    res.status(500).json({ message: 'Could not record event' });
  }
});

// Lets the tracker page show the device name before it starts sending.
publicRouter.get('/whoami', async (req, res) => {
  const device = await Device.findOne({ deviceKey: String(req.query.key || '') }).lean();
  if (!device) return res.status(404).json({ message: 'Unknown device key.' });
  res.json({ name: device.name, active: device.active });
});

// ============ ADMIN / OPERATION MANAGER ============
const router = express.Router();
router.use(protect(['admin', 'operation_manager']));
// Operation managers can look, only admins can change.
router.use((req, res, next) => {
  if (req.user.role !== 'admin' && req.method !== 'GET') {
    return res.status(403).json({ message: 'Only an admin can change devices and locations.' });
  }
  next();
});

// ---- locations ----
// Where phones should open the tracker link from. PUBLIC_URL (e.g. an https tunnel / your domain) wins;
// otherwise the computer's Wi-Fi/LAN addresses are returned so links never say "localhost".
router.get('/config', (req, res) => {
  const lanIps = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  res.json({ publicUrl: String(process.env.PUBLIC_URL || '').replace(/\/+$/, ''), lanIps });
});

// Make sure the fixed office exists: created from OFFICE_LAT / OFFICE_LNG in .env the first time.
const ensureOffice = async () => {
  if (await Location.exists({ isOffice: true })) return;
  const o = getOfficeConfig();
  if (!o.configured) return;
  const taken = await Location.findOne({ nameKey: 'office' });
  if (taken) { taken.isOffice = true; await taken.save(); return; }
  await Location.create({ name: 'Office', nameKey: 'office', code: 'OFFICE', lat: o.lat, lng: o.lng, radius: o.radius, isOffice: true });
};

router.get('/locations', async (req, res) => {
  await ensureOffice();
  const list = await Location.find().sort({ name: 1 }).lean();
  res.json({ locations: list.map(locationView) });
});

const readLocationBody = (body) => {
  const name = String(body.name || '').trim();
  const lat = num(body.lat);
  const lng = num(body.lng);
  const radius = num(body.radius);
  if (!name) return { error: 'Location name is required' };
  if (!validCoords(lat, lng)) return { error: 'Enter a valid latitude and longitude' };
  if (!Number.isFinite(radius) || radius < 10 || radius > 50000) return { error: 'Radius must be between 10 and 50000 metres' };
  return { name, lat, lng, radius };
};

router.post('/locations', async (req, res) => {
  const v = readLocationBody(req.body);
  if (v.error) return res.status(400).json({ message: v.error });
  const nameKey = v.name.toLowerCase();
  if (await Location.exists({ nameKey })) return res.status(409).json({ message: 'A location with that name already exists' });
  const code = String(req.body.code || '').trim().toUpperCase() || v.name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() + crypto.randomInt(10, 99);
  if (await Location.exists({ code })) return res.status(409).json({ message: 'That location code is already used' });
  const loc = await Location.create({ ...v, nameKey, code });
  res.status(201).json({ location: locationView(loc) });
});

router.put('/locations/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid location' });
  const loc = await Location.findById(req.params.id);
  if (!loc) return res.status(404).json({ message: 'Location not found' });
  const v = readLocationBody({ ...loc.toObject(), ...req.body });
  if (v.error) return res.status(400).json({ message: v.error });
  const nameKey = v.name.toLowerCase();
  if (await Location.exists({ nameKey, _id: { $ne: loc._id } })) return res.status(409).json({ message: 'A location with that name already exists' });
  Object.assign(loc, v, { nameKey });
  if (typeof req.body.active === 'boolean') loc.active = req.body.active;
  await loc.save();
  res.json({ location: locationView(loc) });
});

// Fix (set or change) the office coordinates. Body: { lat, lng, radius } — or empty to copy them from .env.
router.put('/office', async (req, res) => {
  const env = getOfficeConfig();
  const lat = req.body.lat === undefined ? env.lat : num(req.body.lat);
  const lng = req.body.lng === undefined ? env.lng : num(req.body.lng);
  const radius = req.body.radius === undefined ? env.radius : num(req.body.radius);
  if (!validCoords(lat, lng)) return res.status(400).json({ message: 'Enter valid office coordinates (or set OFFICE_LAT / OFFICE_LNG in backend/.env)' });
  if (!Number.isFinite(radius) || radius < 10 || radius > 50000) return res.status(400).json({ message: 'Radius must be between 10 and 50000 metres' });
  let office = await Location.findOne({ isOffice: true });
  if (!office) office = await Location.findOne({ nameKey: 'office' });
  if (!office) office = new Location({ name: 'Office', nameKey: 'office', code: 'OFFICE' });
  Object.assign(office, { lat, lng, radius, isOffice: true, active: true });
  await office.save();
  res.json({ location: locationView(office) });
});

router.delete('/locations/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid location' });
  if (await Location.exists({ _id: req.params.id, isOffice: true })) return res.status(400).json({ message: 'The office location is fixed and cannot be deleted. Edit its coordinates instead.' });
  await Location.deleteOne({ _id: req.params.id });
  await Device.updateMany({ currentLocationId: req.params.id }, { $set: { currentLocationId: null } });
  await DeviceVisit.deleteMany({ locationId: req.params.id });
  res.json({ message: 'Location deleted' });
});

// ---- devices ----
router.get('/devices', async (req, res) => {
  await closeStaleVisits();
  const [list, locs] = await Promise.all([Device.find().sort({ name: 1 }).lean(), Location.find().select('name').lean()]);
  const names = new Map(locs.map((l) => [String(l._id), l.name]));
  res.json({ devices: list.map((d) => deviceView(d, names.get(String(d.currentLocationId)))) });
});

router.post('/devices', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Device name is required' });
  const type = ['phone', 'laptop', 'tablet', 'tag', 'other'].includes(req.body.type) ? req.body.type : 'phone';
  let ownerName = String(req.body.ownerName || '').trim();
  let ownerId = null;
  let ownerRole = '';
  if (req.body.ownerId) {
    if (!validId(req.body.ownerId)) return res.status(400).json({ message: 'Invalid owner' });
    for (const [role, Model] of Object.entries(roleModels)) {
      const u = await Model.findById(req.body.ownerId).select('name fullname email').lean();
      if (u) { ownerId = u._id; ownerRole = role; ownerName = ownerName || u.name || u.fullname || u.email; break; }
    }
  }
  const device = await Device.create({ name, type, ownerName, ownerId, ownerRole, deviceKey: crypto.randomBytes(24).toString('hex') });
  res.status(201).json({ device: deviceView(device) });
});

router.put('/devices/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid device' });
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'Device name is required' });
    device.name = name;
  }
  if (req.body.ownerName !== undefined) device.ownerName = String(req.body.ownerName).trim();
  if (typeof req.body.active === 'boolean') {
    device.active = req.body.active;
    if (!device.active) {
      await DeviceVisit.updateMany({ deviceId: device._id, outAt: null }, { $set: { outAt: new Date() } });
      device.currentLocationId = null;
    }
  }
  if (req.body.regenerateKey) device.deviceKey = crypto.randomBytes(24).toString('hex');
  await device.save();
  res.json({ device: deviceView(device) });
});

router.delete('/devices/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid device' });
  await Device.deleteOne({ _id: req.params.id });
  await DeviceVisit.deleteMany({ deviceId: req.params.id });
  res.json({ message: 'Device deleted' });
});

// ---- log: GET /api/devices/visits?from=YYYY-MM-DD&to=YYYY-MM-DD&deviceId=&locationId= ----
router.get('/visits', async (req, res) => {
  await closeStaleVisits();
  const filter = {};
  if (req.query.deviceId) {
    if (!validId(req.query.deviceId)) return res.status(400).json({ message: 'Invalid device' });
    filter.deviceId = req.query.deviceId;
  }
  if (req.query.locationId) {
    if (!validId(req.query.locationId)) return res.status(400).json({ message: 'Invalid location' });
    filter.locationId = req.query.locationId;
  }
  const range = {};
  if (req.query.from) { const d = new Date(`${req.query.from}T00:00:00`); if (!isNaN(d)) range.$gte = d; }
  if (req.query.to) { const d = new Date(`${req.query.to}T23:59:59.999`); if (!isNaN(d)) range.$lte = d; }
  if (Object.keys(range).length) filter.inAt = range;
  const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 5000);
  const visits = await DeviceVisit.find(filter).sort({ inAt: -1 }).limit(limit).lean();
  const [devices, locations] = await Promise.all([
    Device.find({ _id: { $in: [...new Set(visits.map((v) => String(v.deviceId)))] } }).select('name ownerName type').lean(),
    Location.find({ _id: { $in: [...new Set(visits.map((v) => String(v.locationId)))] } }).select('name').lean()
  ]);
  const dMap = new Map(devices.map((d) => [String(d._id), d]));
  const lMap = new Map(locations.map((l) => [String(l._id), l]));
  res.json({
    visits: visits.map((v) => ({
      id: String(v._id),
      deviceId: String(v.deviceId),
      deviceName: dMap.get(String(v.deviceId))?.name || 'Deleted device',
      ownerName: dMap.get(String(v.deviceId))?.ownerName || '',
      locationId: String(v.locationId),
      locationName: lMap.get(String(v.locationId))?.name || 'Deleted location',
      inAt: v.inAt,
      outAt: v.outAt,
      lastSeenAt: v.lastSeenAt,
      source: v.source
    }))
  });
});

export default router;
