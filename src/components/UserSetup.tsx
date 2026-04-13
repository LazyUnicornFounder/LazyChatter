import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EMOJI_OPTIONS = ['🦊', '🐙', '🔥', '👾', '🌮', '🍕', '🚀', '🦄', '🎮', '💀', '🌈', '🤖'];

const UserSetup = ({ onComplete }: { onComplete: (name: string, emoji: string) => void }) => {
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !selectedEmoji) return;
    localStorage.setItem('lazyship_name', name.trim());
    localStorage.setItem('lazyship_emoji', selectedEmoji);
    onComplete(name.trim(), selectedEmoji);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="glass-card p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Pick your vibe ✨</h2>
          <p className="text-muted-foreground text-sm">Choose a name and avatar</p>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          maxLength={20}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />

        <div className="grid grid-cols-6 gap-3">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setSelectedEmoji(emoji)}
              className={`text-2xl p-2 rounded-xl transition-all ${
                selectedEmoji === emoji
                  ? 'bg-primary/20 scale-110 border border-primary'
                  : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !selectedEmoji}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Enter Room →
        </button>
      </div>
    </div>
  );
};

export default UserSetup;
