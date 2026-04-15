import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import DemoChat from '@/components/DemoChat';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import OpenSourceBanner from "@/components/OpenSourceBanner";
import PortfolioFooter from "@/components/PortfolioFooter";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [roomCount, setRoomCount] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });
      setRoomCount(count ?? 0);
    };
    load();
  }, []);

  const handleStartRoom = () => {
    const id = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${id}`);
  };

  return (
    <div className="min-h-screen bg-background relative dot-grid">
      

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-xl font-bold text-primary flex items-center gap-2">Lazy Chatter 🚀 <span className="text-[10px] font-semibold bg-[hsl(var(--cyan))] text-primary-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wider">Beta</span></span>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button
                onClick={() => navigate('/saved')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Saved ⭐
              </button>
              <button
                onClick={signOut}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </button>
          )}
          <button
            onClick={handleStartRoom}
            className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Start a Room
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center pt-20 pb-16 px-6 max-w-4xl mx-auto">
        <h1 className="text-5xl sm:text-7xl font-bold gradient-text-lime-cyan leading-tight mb-6">
          Talk about it.<br />Ship it. 🛸
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Chat with your friends about an idea. Hit one button. Live website in 30 seconds.
        </p>
        <button
          onClick={handleStartRoom}
          className="bg-primary text-primary-foreground font-bold text-lg px-8 py-4 rounded-xl glow-lime glow-lime-hover transition-all hover:scale-105"
        >
          Start a Room →
        </button>
        <p className="text-sm text-muted-foreground mt-4">
          no sign up. no download. just vibes.
        </p>
        {roomCount !== null && roomCount > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            <span className="text-primary font-bold">{roomCount.toLocaleString()}</span> rooms created so far 🔥
          </p>
        )}
      </section>

      {/* Demo Chat */}
      <section className="relative z-10 py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-foreground mb-8">
          See it in action ⚡
        </h2>
        <DemoChat />
      </section>

      {/* Feature Cards */}
      <section className="relative z-10 py-16 px-6 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { emoji: '💬', title: 'Just Chat', desc: 'No briefs, no wireframes, just talk.' },
            { emoji: '⚡', title: '30 Seconds', desc: 'AI builds and deploys instantly.' },
            { emoji: '🔗', title: 'Share the Link', desc: 'Your idea is live on the internet.' },
          ].map((card) => (
            <div
              key={card.title}
              className="glass-card glass-card-hover p-8 text-center transition-all duration-300 hover:scale-105"
            >
              <span className="text-4xl mb-4 block">{card.emoji}</span>
              <h3 className="text-xl font-bold text-foreground mb-2">{card.title}</h3>
              <p className="text-muted-foreground text-sm">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-12 text-muted-foreground text-sm">
        made for people with more ideas than time 😴
      </footer>
          <OpenSourceBanner />
          <PortfolioFooter />
    </div>
  );
};

export default Index;
