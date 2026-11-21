import mongoose from 'mongoose';

// One row per person who should see the notification.
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, required: true },
  topic: { type: String, default: 'general' },
  tone: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  link: { type: String, default: '' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  readAt: { type: Date, default: null }
}, { timestamps: true, collection: 'notifications' });

notificationSchema.index({ userId: 1, createdAt: -1 });
// old notifications clean themselves up after 60 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
