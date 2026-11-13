import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema({
  trackId: { type: String, required: true },          // "<provider>:<id>"
  provider: { type: String, enum: ['youtube', 'jamendo', 'itunes'], required: true },
  title: { type: String, default: '' },
  artist: { type: String, default: '' },
  artwork: { type: String, default: '' },
  audioUrl: { type: String, default: '' },            // jamendo / itunes
  videoId: { type: String, default: '' },             // youtube
  duration: { type: Number, default: 0 },             // seconds (0 = unknown)
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const playlistSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, required: true },
  name: { type: String, trim: true, required: true, maxlength: 60 },
  isFavorite: { type: Boolean, default: false },
  tracks: { type: [trackSchema], default: [] }
}, { timestamps: true, collection: 'playlists' });

export default mongoose.models.Playlist || mongoose.model('Playlist', playlistSchema);
