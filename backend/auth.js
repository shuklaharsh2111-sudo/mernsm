
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import Admin from './admin/Admin.js';
import Sme from './sme/Sme.js';
import Attendance from './attendance/Attendance.js';
import { checkLocation } from './attendance/geo.js';

const router = express.Router();

const createToken = (user, role, sessionId) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role,
      sid: sessionId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

const getUserDetails = (user, role) => ({
  id: user._id,
  name: user.name || user.fullname || user.email,
  email: user.email,
  avatar: user.avatar || user.profileImage || '',
  role
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let user = await Admin.findOne({
      email: normalizedEmail
    }).select('+password');

    let role = 'admin';

    if (!user) {
      user = await Sme.findOne({
        email: normalizedEmail
      }).select('+password');

      role = 'sme';
    }

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    if (!user.password) {
      return res.status(401).json({
        message: 'Account password is not configured'
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Office-only login (geofence) - checked only after the password is correct
    const geo = checkLocation(role, req.body);

    if (!geo.ok) {
      return res.status(geo.status).json({
        message: geo.message,
        code: geo.code
      });
    }

    const sessionId = crypto.randomUUID();

    await Attendance.create({
      userId: user._id,
      role,
      name: user.name || user.fullname || user.email,
      email: user.email,
      sessionId,
      loginAt: new Date(),
      loginLocation: geo.location,
      ipAddress: req.ip
    });

    const token = createToken(user, role, sessionId);

    res.cookie('token', token, cookieOptions);

    return res.status(200).json({
      message: 'Login successful',
      user: getUserDetails(user, role)
    });

  } catch (error) {
    console.error('Login Error:', error);

    return res.status(500).json({
      message: 'Server error during login'
    });
  }
});

// AUTHENTICATED USER
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        message: 'Not authenticated'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const Model =
      decoded.role === 'admin' ? Admin :
      decoded.role === 'sme' ? Sme : null;

    if (!Model) {
      return res.status(403).json({
        message: 'Invalid role'
      });
    }

    const user = await Model.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: 'User not found'
      });
    }

    return res.json({
      user: getUserDetails(user, decoded.role)
    });

  } catch (error) {
    return res.status(401).json({
      message: 'Session expired or invalid'
    });
  }
});

// LOGOUT
router.post('/logout', async (req, res) => {
  // Stamp the logout time on this session's attendance record
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.sid) {
        await Attendance.updateOne(
          { sessionId: decoded.sid, logoutAt: null },
          { $set: { logoutAt: new Date() } }
        );
      }
    }
  } catch {
    // expired/invalid token - nothing to stamp, still clear the cookie
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  return res.json({
    message: 'Logged out successfully'
  });
});

// ROLE PROTECTION
export const protect = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.cookies.token;

      if (!token) {
        return res.status(401).json({
          message: 'Authentication required'
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      if (
        allowedRoles.length &&
        !allowedRoles.includes(decoded.role)
      ) {
        return res.status(403).json({
          message: 'Access denied'
        });
      }

      req.user = decoded;
      next();

    } catch {
      return res.status(401).json({
        message: 'Invalid or expired session'
      });
    }
  };
};

export default router;
