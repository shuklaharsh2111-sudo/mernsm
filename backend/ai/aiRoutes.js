import express from 'express';
import { protect } from '../auth.js';
import { generateAIResponse } from './aiService.js';
const router = express.Router();
router.post(
  '/chat',
  protect([
    'admin',
    'operation_manager',
    'reporting_manager',
    'sme',
    'des',
    'smi',
    'hr'
  ]),
  async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          message: 'Please enter a message.'
        });
      }
      if (message.length > 4000) {
        return res.status(400).json({
          message: 'Message cannot exceed 4000 characters.'
        });
      }
      if (!Array.isArray(history) || history.length > 20) {
        return res.status(400).json({
          message: 'Invalid conversation history.'
        });
      }
      const reply = await generateAIResponse({
        message: message.trim(),
        history,
        user: req.user
      });
      return res.json({
        success: true,
        reply
      });
    } catch (error) {
      console.error('AI Chat Error:', error);
      if (error.status === 429) {
        return res.status(429).json({
          message: 'AI usage limit reached. Please try again later.'
        });
      }
      if (error.status === 401) {
        return res.status(502).json({
          message: 'AI service authentication failed. Please contact the administrator.'
        });
      }
      return res.status(500).json({
        message: error.message === 'OpenAI API key is not configured.'
          ? 'AI service is not configured yet.'
          : 'Unable to generate a response. Please try again.'
      });
    }
  }
);
export default router;