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