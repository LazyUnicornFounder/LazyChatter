import { useState, useEffect } from 'react';

const messages = [
  { sender: 'lime', text: 'bro what if we made an app for rating campus food' },
  { sender: 'pink', text: 'dude yes, charge $2/mo' },
  { sender: 'lime', text: 'add a leaderboard' },
  { sender: 'ship', text: '' },
  { sender: 'system', text: '🚀 campusbites.lazyship.app is live' },
];

const DemoChat = () => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (visibleCount >= messages.length) {
      const timer = setTimeout(() => setVisibleCount(0), 4000);
      return () => clearTimeout(timer);
    }
    setTyping(true);
    const typingTimer = setTimeout(() => {
      setTyping(false);
      setVisibleCount((c) => c + 1);
    }, visibleCount === 3 ? 1500 : 1200);
    return () => clearTimeout(typingTimer);
  }, [visibleCount]);

  return (
    <div className="glass-card p-6 max-w-md mx-auto space-y-3">
      <div className="flex items-center gap-2 mb-4 text-muted-foreground text-sm">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Room: xyz789
      </div>

      {messages.slice(0, visibleCount).map((msg, i) => {
        if (msg.sender === 'ship') {
          return (
            <div key={i} className="flex justify-center my-4">
              <button className="bg-gradient-to-r from-primary to-cyan text-primary-foreground font-bold px-6 py-3 rounded-xl pulse-glow text-sm">
                SHIP IT 🚀
              </button>
            </div>
          );
        }
        if (msg.sender === 'system') {
          return (
            <p key={i} className="text-center text-sm text-muted-foreground">{msg.text}</p>
          );
        }
        const isLime = msg.sender === 'lime';
        return (
          <div key={i} className={`flex ${isLime ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${
                isLime
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground'
              }`}
            >
              {msg.text}
            </div>
          </div>
        );
      })}

      {typing && visibleCount < messages.length && (
        <div className={`flex ${messages[visibleCount]?.sender === 'lime' ? 'justify-end' : messages[visibleCount]?.sender === 'ship' || messages[visibleCount]?.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
          <div className="flex gap-1 px-4 py-3 rounded-2xl bg-secondary">
            <span className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoChat;
