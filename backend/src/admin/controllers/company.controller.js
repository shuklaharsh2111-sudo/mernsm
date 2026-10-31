import mongoose from 'mongoose';
import Company, { MAX_COMPANIES } from '../models/Company.js';
import User from '../models/User.js';

const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const companyView = (c) => ({ id: c._id, name: c.name, logo: c.logo || '' });

const validLogo = (logo) =>
  logo === '' || (typeof logo === 'string' && logo.length <= 150000 && LOGO_RE.test(logo));

const nameTaken = async (name, exceptId) => {
  const found = await Company.findOne({ name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') });
  return Boolean(found && String(found._id) !== String(exceptId));
};

export const listCompanies = async (req, res, next) => {
  try {
    const companies = await Company.find().sort({ createdAt: 1 });
    res.json({ companies: companies.map(companyView), max: MAX_COMPANIES });
  } catch (err) {
    next(err);
  }
};

export const createCompany = async (req, res, next) => {
  try {
    const { name, logo = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Company name is required' });
    if (name.trim().length > 80) return res.status(400).json({ message: 'Company name is too long' });
    if (!validLogo(logo)) return res.status(400).json({ message: 'Upload a valid png, jpeg or webp logo' });
    if ((await Company.countDocuments()) >= MAX_COMPANIES) {
      return res.status(409).json({ message: `You can add at most ${MAX_COMPANIES} companies` });
    }
    if (await nameTaken(name)) {
      return res.status(409).json({ message: 'A company with this name already exists' });
    }
    const company = await Company.create({ name, logo });
    res.status(201).json({ company: companyView(company) });
  } catch (err) {
    next(err);
  }
};

export const updateCompany = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Company not found' });
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const { name, logo } = req.body;
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Company name is required' });
      if (name.trim().length > 80) return res.status(400).json({ message: 'Company name is too long' });
      if (await nameTaken(name, company._id)) {
        return res.status(409).json({ message: 'A company with this name already exists' });
      }
      company.name = name;
    }
    if (logo !== undefined) {
      if (!validLogo(logo)) return res.status(400).json({ message: 'Upload a valid png, jpeg or webp logo' });
      company.logo = logo; // '' removes the logo
    }
    await company.save();
    res.json({ company: companyView(company) });
  } catch (err) {
    next(err);
  }
};

export const deleteCompany = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Company not found' });
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    // Unassign it from every user.
    await User.updateMany({ companies: company._id }, { $pull: { companies: company._id } });
    res.json({ message: 'Company deleted' });
  } catch (err) {
    next(err);
  }
};
