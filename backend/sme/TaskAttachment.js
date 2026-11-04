<<<<<<< HEAD

import mongoose from 'mongoose';

const taskAttachmentSchema = new mongoose.Schema({
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Sme', required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
    size: { type: Number, required: true },
    imageData: { type: Buffer, required: true }
}, { timestamps: true, collection: 'taskattachments' });

const TaskAttachment = mongoose.models.TaskAttachment || mongoose.model('TaskAttachment', taskAttachmentSchema);

export default TaskAttachment;
=======
import mongoose from 'mongoose';

const taskAttachmentSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sme',
        required: true,
        index: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    collection: 'taskattachments'
});

const TaskAttachment = mongoose.models.TaskAttachment ||
    mongoose.model('TaskAttachment', taskAttachmentSchema);

export default TaskAttachment;
>>>>>>> 2795ce4d0935b2d29bfb7bb14839f1e2600dc8af
