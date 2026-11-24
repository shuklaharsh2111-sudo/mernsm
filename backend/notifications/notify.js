import Notification from './Notification.js';
import Sme from '../sme/Sme.js';
import { roleModels, Client } from '../admin/UserModels.js';

// Where a notification should take each role when it is clicked.
const LINKS = {
  creatives: { admin: '/admin/creatives', operation_manager: '/om/creatives', reporting_manager: '/rm/creatives', sme: '/sme/pending-creatives', des: '/des/creatives', clients: '/client/calendar' },
  meetings: { admin: '/admin/meetings', operation_manager: '/om/meetings', reporting_manager: '/rm/meetings', sme: '/sme' },
  tasks: { sme: '/sme', smi: '/smi' },
  sops: { sme: '/sme', smi: '/smi' },
  invoices: { admin: '/admin/invoices', operation_manager: '/om/invoices' },
  team: { reporting_manager: '/rm/team' },
  forms: { sme: '/sme/companies', smi: '/smi/companies', clients: '/client/forms' },
  suggestions: { admin: '/admin/suggestions', hr: '/hr/suggestions' },
  home: { admin: '/admin', operation_manager: '/om', reporting_manager: '/rm', sme: '/sme', smi: '/smi', des: '/des', hr: '/hr/recruitment', clients: '/client' }
};
export const linkFor = (role, topic) => LINKS[topic]?.[role] || LINKS.home[role] || '/';

const actorInfo = async (actor) => {
  if (!actor?.id) return { actorId: null, actorName: '', actorRole: '' };
  try {
    const Model = roleModels[actor.role];
    const u = Model ? await Model.findById(actor.id).select('name fullname email').lean() : null;
    return { actorId: actor.id, actorName: u?.name || u?.fullname || u?.email || '', actorRole: actor.role };
  } catch {
    return { actorId: actor.id, actorName: '', actorRole: actor.role };
  }
};

const fill = (text, name) => String(text || '').replaceAll('{actor}', name || 'Someone');

/**
 * Send a notification. NEVER throws: a failed notification must not break the action that triggered it.
 *   recipients: [{ id, role }]   (the person who did the action is skipped automatically)
 *   payload:    { topic, tone, title, message }   ("{actor}" is replaced by the name of whoever did it)
 */
export const notifyUsers = async (recipients, payload, actor) => {
  try {
    const who = await actorInfo(actor);
    const seen = new Set();
    const rows = [];
    for (const r of recipients || []) {
      if (!r?.id || !r?.role) continue;
      const key = `${r.role}:${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (who.actorId && String(r.id) === String(who.actorId)) continue; // no self notifications
      rows.push({
        userId: r.id,
        role: r.role,
        topic: payload.topic || 'general',
        tone: payload.tone || 'info',
        title: fill(payload.title, who.actorName),
        message: fill(payload.message, who.actorName),
        link: linkFor(r.role, payload.topic),
        ...who
      });
    }
    if (rows.length) await Notification.insertMany(rows);
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};

// Everyone who has one of these roles (e.g. all admins and operation managers).
export const roleRecipients = async (roles) => {
  const groups = await Promise.all(
    roles.map(async (role) => {
      const Model = roleModels[role];
      const docs = Model ? await Model.find().select('_id').lean() : [];
      return docs.map((d) => ({ id: d._id, role }));
    })
  );
  return groups.flat();
};

export const notifyRoles = async (roles, payload, actor) => {
  try {
    return await notifyUsers(await roleRecipients(roles), payload, actor);
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};

// The people who review an SME's work: every admin, every operation manager, and the SME's reporting manager.
export const notifyReviewers = async (smeId, payload, actor) => {
  try {
    const recipients = await roleRecipients(['admin', 'operation_manager']);
    const sme = await Sme.findById(smeId).select('reportingManagerId').lean();
    if (sme?.reportingManagerId) recipients.push({ id: sme.reportingManagerId, role: 'reporting_manager' });
    return await notifyUsers(recipients, payload, actor);
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};

// The client accounts linked to a company (they see that company's final creatives on their calendar).
export const notifyCompanyClients = async (companyId, payload, actor) => {
  try {
    if (!companyId) return;
    const clients = await Client.find({ companies: companyId }).select('_id').lean();
    return await notifyUsers(clients.map((c) => ({ id: c._id, role: 'clients' })), payload, actor);
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};
