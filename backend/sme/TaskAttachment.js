import mongoose from 'mongoose';

const taskAttachmentSchema = new mongoose.Schema({
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileType: { type: String, enum: ['image', 'video', 'pdf', 'document', 'other'], required: true },
    size: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('TaskAttachment', taskAttachmentSchema);