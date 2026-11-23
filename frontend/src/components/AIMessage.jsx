
import { Bot, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const AIMessage = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isAI = message.role === 'assistant';

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`askai-message ${isAI ? 'ai' : 'user'} ${message.error ? 'error' : ''}`}>
      <div className="askai-message-avatar">
        {isAI ? <Bot size={18} /> : <User size={18} />}
      </div>

      <div className="askai-message-content">
        <div className="askai-message-meta">
          <strong>{isAI ? 'Unstoppable AI' : 'You'}</strong>
          <span>
            {message.time
              ? new Date(message.time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : ''}
          </span>
        </div>

        <div className="askai-message-text">
          {message.content}
        </div>

        {isAI && !message.error && (
          <button className="askai-copy" onClick={copyMessage} title="Copy response">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AIMessage;
