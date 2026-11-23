
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_INSTRUCTIONS = `
You are Unstoppable AI, the intelligent assistant of Unstoppable Solutions Social Media Manager.

Your responsibilities:
1. Help users with business, management, HR, social media, recruitment and productivity questions.
2. Give clear, practical and professional answers.
3. Use simple English or Hinglish depending on the user's language.
4. Help users understand their work and improve productivity.
5. Never pretend that you have accessed company databases or live reports unless that information is explicitly provided.
6. Never invent employee details, attendance records, company statistics or business reports.
7. Do not claim to execute actions such as deleting users, updating tasks or sending messages.
8. Protect confidential business information.
9. If you do not know something, clearly say so.
10. Give structured and easy-to-understand answers.

You are currently operating as a general AI assistant. You do not have automatic access to the company's MongoDB database.
`;

export const generateAIResponse = async ({ message, history = [], user }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured.');
  }

  const safeHistory = history
    .filter(item =>
      ['user', 'assistant'].includes(item.role) &&
      typeof item.content === 'string' &&
      item.content.trim()
    )
    .slice(-20)
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, 4000)
    }));

  const input = safeHistory.filter((item, index) => {
    return index === 0 || item.role !== safeHistory[index - 1].role;
  });

  if (input.length === 0 || input[input.length - 1].role !== 'user') {
    input.push({ role: 'user', content: message });
  } else {
    input[input.length - 1] = {
      role: 'user',
      content: message
    };
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-6.2-sol',
    instructions: `${SYSTEM_INSTRUCTIONS}

Current authenticated user:
Name: ${String(user.name || user.fullname || 'User').slice(0, 100)}
Role: ${String(user.role || 'employee').slice(0, 50)}

This information is provided only for conversational context.`,
    input,
    max_output_tokens: 1500
  });

  const reply = response.output_text?.trim();

  if (!reply) {
    throw new Error('AI could not generate a response. Please try again.');
  }

  return reply;
};
