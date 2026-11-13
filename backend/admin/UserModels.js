import mongoose from 'mongoose';
import Admin from './Admin.js';
import Sme from '../sme/Sme.js';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  fullname: { type: String, trim: true },
  contact: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  password: { type: String, required: true, select: false },
  avatar: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  avatarPublicId: { type: String, default: '' },
  role: { type: String, required: true },
  reportingManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportingManager', default: null },
  companies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }]
}, { timestamps: true });
const createModel = (modelName, collectionName) => mongoose.models[modelName] || mongoose.model(modelName, userSchema, collectionName);
export const ReportingManager = createModel('ReportingManager', 'reporting_managers');
export const Smi = createModel('Smi', 'smis');
export const Des = createModel('Des', 'des');
export const Hr = createModel('Hr', 'hrs');
export const Client = createModel('Client', 'clients');
export const roleModels = {
  admin: Admin,
  reporting_manager: ReportingManager,
  sme: Sme,
  smi: Smi,
  des: Des,
  hr: Hr,
  clients: Client
};
export const roleCollections = {
  admin: 'admins',
  reporting_manager: 'reporting_managers',
  sme: 'smes',
  smi: 'smis',
  des: 'des',
  hr: 'hrs',
  clients: 'clients'
};
export default userSchema;