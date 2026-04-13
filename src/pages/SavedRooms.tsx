import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type SavedRoom = {
  id: string;
  room_id: string;
  created_at: string;
  rooms: {
    shipped: boolean;
    deployed_url: string | null;
    created_at: string;
  } | null;
};

const SavedRooms = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rooms, setRooms] = useState<SavedRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('saved_rooms')
        .select('id, room_id, created_at, rooms(shipped, deployed_url, created_at)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Failed to load saved rooms');
      } else {
        setRooms((data as any) ?? []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const unsave = async (id: string) => {
    await supabase.from('saved_rooms').delete().eq('id', id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    toast('Room unsaved');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center dot-grid">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dot-grid">
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <button onClick={() => navigate('/')} className="text-xl font-bold text-primary">
          Lazy Chatter 🚀
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Saved Rooms ⭐</h1>

        {rooms.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">No saved rooms yet</p>
            <button
              onClick={() => navigate('/')}
              className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl text-sm hover:opacity-90"
            >
              Start a Room →
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="glass-card glass-card-hover p-5 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigate(`/room/${room.room_id}`)}
                    className="text-foreground font-bold hover:text-primary transition-colors"
                  >
                    Room: {room.room_id}
                  </button>
                  {room.rooms?.shipped && (
                    <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {room.rooms?.deployed_url && (
                    <a
                      href={room.rooms.deployed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-sm hover:underline"
                    >
                      Visit 🔗
                    </a>
                  )}
                  <button
                    onClick={() => unsave(room.id)}
                    className="text-muted-foreground hover:text-destructive text-sm transition-colors"
                  >
                    Unsave
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedRooms;
