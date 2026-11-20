import mongoose from 'mongoose';

// "Base skills" HR sets for a role. Every new resume is compared with these.
const roleSkillSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, trim: true, maxlength: 80 },
    skills: { type: [String], default: [] },
    minMatch: { type: Number, default: 60, min: 10, max: 100 }, // % of the base skills a resume must cover
    autoShortlist: { type: Boolean, default: true },            // tick "CV shortlisted" on its own when it passes
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Hr' }
  },
  { timestamps: true, collection: 'role_skills' }
);

const RoleSkill = mongoose.models.RoleSkill || mongoose.model('RoleSkill', roleSkillSchema);
export default RoleSkill;
