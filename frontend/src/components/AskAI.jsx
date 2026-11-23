
import { useEffect, useRef, useState } from 'react';
import { Bot, X, Sparkles, Plus, History, Send, LoaderCircle, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import AIMessage from './AIMessage';
import '../styles/askai.css';

const suggestions = [
  { icon: 'users', title: 'Team overview', prompt: 'Help me understand my team overview.' },
  { icon: 'calendar', title: 'Upcoming tasks', prompt: 'Help me plan my upcoming tasks.' },
  { icon: 'chart', title: 'Performance', prompt: 'How can I analyze my work performance?' },
  { icon: 'file', title: 'Generate report', prompt: 'Help me create a professional report.' }
];

const AskAI = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      setMessages([]);
      setConversations([]);
      setActiveConversation(null);
    }
  }, [user]);

  const saveConversation = (updatedMessages) => {
    if (!updatedMessages.length) return;

    const id = activeConversation || Date.now().toString();
    const conversation = {
      id,
      title: updatedMessages.find(m => m.role === 'user')?.content?.slice(0, 45) || 'New conversation',
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    };

    setConversations(previous => {
      const exists = previous.some(c => c.id === id);
      const updated = exists
        ? previous.map(c => c.id === id ? conversation : c)
        : [conversation, ...previous];

      return updated.slice(0, 30);
    });

    setActiveConversation(id);
  };

  const newChat = () => {
    setMessages([]);
    setActiveConversation(null);
    setShowHistory(false);
    setInput('');
  };

  const loadConversation = (conversation) => {
    setMessages(conversation.messages);
    setActiveConversation(conversation.id);
    setShowHistory(false);
  };

  const deleteConversation = (id, e) => {
    e.stopPropagation();
    setConversations(previous => previous.filter(c => c.id !== id));

    if (activeConversation === id) {
      newChat();
    }
  };

  const sendMessage = async (text = input) => {
    const message = text.trim();

    if (!message || loading) return;

    const updatedMessages = [
      ...messages,
      {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        time: new Date().toISOString()
      }
    ];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const history = updatedMessages.slice(-20).map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data } = await api.post('/ai/chat', {
        message,
        history
      });

      const finalMessages = [
        ...updatedMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply,
          time: new Date().toISOString()
        }
      ];

      setMessages(finalMessages);
      saveConversation(finalMessages);
    } catch (error) {
      setMessages(previous => [
        ...previous,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: error.response?.data?.message || 'Something went wrong. Please try again.',
          time: new Date().toISOString(),
          error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          className="askai-float"
          onClick={() => setOpen(true)}
          aria-label="Open AI Assistant"
        >
          <span className="askai-float-glow" />
          <Bot size={25} />
          <span className="askai-float-label">Ask AI</span>
        </button>
      )}

      <div className={`askai-backdrop ${open ? 'visible' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`askai-drawer ${open ? 'open' : ''}`}>
        <header className="askai-header">
          <div className="askai-brand">
            <div className="askai-brand-icon">
              <Sparkles size={21} />
            </div>
            <div>
              <h3>Unstoppable AI</h3>
              <span><i /> Your intelligent workspace assistant</span>
            </div>
          </div>

          <div className="askai-header-actions">
            <button title="New chat" onClick={newChat}>
              <Plus size={19} />
            </button>
            <button title="Chat history" onClick={() => setShowHistory(!showHistory)}>
              <History size={19} />
            </button>
            <button title="Close" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </header>

        {showHistory ? (
          <div className="askai-history">
            <div className="askai-history-heading">
              <h3>Recent conversations</h3>
              <button onClick={newChat}>New chat</button>
            </div>

            {conversations.length === 0 ? (
              <div className="askai-empty-history">
                <History size={32} />
                <p>No conversations yet</p>
              </div>
            ) : conversations.map(conversation => (
              <button
                className={`askai-history-item ${activeConversation === conversation.id ? 'active' : ''}`}
                key={conversation.id}
                onClick={() => loadConversation(conversation)}
              >
                <MessageSquare size={17} />
                <span>{conversation.title}</span>
                <span
                  className="askai-delete-history"
                  onClick={(e) => deleteConversation(conversation.id, e)}
                >
                  <Trash2 size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="askai-chat-body">
              {messages.length === 0 ? (
                <div className="askai-welcome">
                  <div className="askai-welcome-icon">
                    <Sparkles size={31} />
                  </div>
                  <h2>How can I help you?</h2>
                  <p>
                    Hello {user.name || user.fullname || 'there'}! I'm your AI assistant.
                    Ask me anything and let's get things done.
                  </p>

                  <div className="askai-suggestions">
                    {suggestions.map(item => (
                      <button
                        key={item.title}
                        onClick={() => sendMessage(item.prompt)}
                      >
                        <span className="askai-suggestion-icon">
                          {item.icon === 'users' && <Bot size={17} />}
                          {item.icon === 'calendar' && <History size={17} />}
                          {item.icon === 'chart' && <Sparkles size={17} />}
                          {item.icon === 'file' && <MessageSquare size={17} />}
                        </span>
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="askai-messages">
                  {messages.map(message => (
                    <AIMessage key={message.id} message={message} />
                  ))}
                  {loading && (
                    <div className="askai-typing">
                      <div className="askai-message-avatar"><Bot size={17} /></div>
                      <div className="askai-typing-dots">
                        <span /><span /><span />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="askai-composer-area">
              <form className="askai-composer" onSubmit={handleSubmit}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Message Unstoppable AI..."
                  rows={1}
                  maxLength={4000}
                  disabled={loading}
                />
                <div className="askai-composer-bottom">
                  <span>Shift + Enter for new line</span>
                  <button type="submit" disabled={!input.trim() || loading}>
                    {loading ? <LoaderCircle className="askai-spin" size={19} /> : <Send size={19} />}
                  </button>
                </div>
              </form>
              <p className="askai-disclaimer">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

export default AskAI;
