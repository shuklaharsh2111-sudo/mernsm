import mongoose from 'mongoose';
const taskSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: ['one-time', 'recurring'], required: true },
    frequencyDays: { type: Number, enum: [7, 15, 30, null], default: null },
    tatDays: { type: Number, default: null, min: 1, required: function () { return this.category === 'recurring'; } },
    taskType: { type: String, enum: ['Strategy/Pitch Deck', 'Mood Board', 'Shoots', 'Content Planning', 'Content Writing', 'Influencer Collaboration'], required: true },
    objective: { type: String, enum: ['Brand Awareness', 'Lead Generation', 'Brand Positioning', 'Others'], required: true },
    customObjective: { type: String, trim: true, maxlength: 120, default: '' },
    priority: { type: String, enum: ['High', 'Low', 'Critical'], required: true },
    status: { type: String, enum: ['new', 'in-progress', 'completed'], default: 'new' },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    brief: { type: String, trim: true, maxlength: 1000, default: '' },
assignedTo: { type: String, enum: ['', 'Admin', 'SME', 'SMI', 'Designer'], default: '' },
    attachments: [{
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        originalName: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true, collection: 'tasks' });
const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export default Task;