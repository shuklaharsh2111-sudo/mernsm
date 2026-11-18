import express from 'express';
import { protect } from '../auth.js';
import Influencer from './Influencer.js';

const view = (i) => ({
  id: String(i._id),
  name: i.name,
  channels: i.channels || [],
  youtubeLink: i.youtubeLink || '',
  instagramLink: i.instagramLink || '',
  youtubeStats: {
    channelId: i.youtubeStats?.channelId || '',
    title: i.youtubeStats?.title || '',
    handle: i.youtubeStats?.handle || '',
    thumbnail: i.youtubeStats?.thumbnail || '',
    subscribers: i.youtubeStats?.subscribers ?? null,
    totalViews: i.youtubeStats?.totalViews || 0,
    videoCount: i.youtubeStats?.videoCount || 0,
    avgViews: i.youtubeStats?.avgViews || 0,
    engagement: i.youtubeStats?.engagement || 0,
    fetchedAt: i.youtubeStats?.fetchedAt || null
  },
  category: i.category,
  location: i.location,
  followers: i.followers || 0,
  avgReelViews: i.avgReelViews || 0,
  engagement: i.engagement || 0,
  contact: i.contact,
  email: i.email,
  managementAgency: i.managementAgency || '',
  collaborationType: i.collaborationType || 'unpaid',
  collaborationPrice: i.collaborationPrice ?? null,
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
