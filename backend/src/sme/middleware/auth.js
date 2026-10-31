import jwt from 'jsonwebtoken';
import Sme from '../models/Sme.js';

export const protectSme = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'sme') return res.status(403).json({ message: 'SME access only' });

    const sme = await Sme.findById(decoded.id);
    if (!sme) return res.status(401).json({ message: 'Not authorized' });

    req.sme = sme;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
