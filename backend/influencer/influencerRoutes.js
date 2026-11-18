import express from 'express';
import { protect } from '../auth.js';
import Influencer from './Influencer.js';

const view = (i) => ({
  id: String(i._id),
  name: i.name,
  channels: i.channels || [],
  youtubeLink: i.youtubeLink || '',
  instagramLink: i.instagramLink || '',
  category: i.category,
  location: i.location,
  followers: i.followers || 0,
  avgReelViews: i.avgReelViews || 0,
  engagement: i.engagement || 0,
  contact: i.contact,
  email: i.email,
  managementAgency: i.managementAgency,
  createdAt: i.createdAt
});

// The influencer database is shared. SMEs and SMIs can read it (each from their own path).
export const buildInfluencerRouter = (role) => {
  const router = express.Router();
  router.use(protect([role]));

  router.get('/', async (req, res) => {
    try {
      const list = await Influencer.find().sort({ followers: -1, name: 1 }).limit(2000).lean();
      res.json({ influencers: list.map(view) });
    } catch (error) {
      console.error(`${role} fetch influencers error:`, error);
      res.status(500).json({ message: 'Unable to fetch influencers' });
    }
  });

  return router;
};
