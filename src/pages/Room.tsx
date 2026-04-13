import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import UserSetup from '@/components/UserSetup';
import { toast } from 'sonner';

type Message = {
  id: string;
  room_id: string;
  sender_name: string;
  sender_emoji: string;
  content: string;
  type: string;
  created_at: string;
};

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [chatUser, setChatUser] = useState<{ name: string; emoji: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [shipping, setShipping] = useState(false);
  const [roomData, setRoomData] = useState<{ shipped: boolean; deployed_url: string | null } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const { user: authUser } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasShownInvite = useRef(false);

  // Check localStorage for existing user
  useEffect(() => {
    const name = localStorage.getItem('lazyship_name');
    const emoji = localStorage.getItem('lazyship_emoji');
    if (name && emoji) setChatUser({ name, emoji });
  }, []);

  // Ensure room exists
  useEffect(() => {
    if (!roomId) return;
    const ensureRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (!data) {
        await supabase.from('rooms').insert({ id: roomId });
      } else {
        setRoomData({ shipped: data.shipped, deployed_url: data.deployed_url });
      }
    };
    ensureRoom();
  }, [roomId]);

  // Load messages & subscribe to realtime
  useEffect(() => {
    if (!roomId || !user) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as Message[]);
    };
    loadMessages();

    // Send join system message
    const sendJoin = async () => {
      await supabase.from('messages').insert({
        room_id: roomId,
        sender_name: 'system',
        sender_emoji: '',
        content: `${user.emoji} ${user.name} joined the room`,
        type: 'system',
      });
    };
    sendJoin();

    // Show invite toast
    if (!hasShownInvite.current) {
      hasShownInvite.current = true;
      const link = window.location.href;
      toast('Invite your friend 🔗', {
        description: link,
        action: {
          label: 'Copy',
          onClick: () => navigator.clipboard.writeText(link),
        },
      });
    }

    // Realtime subscription
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !user || !roomId) return;
    const content = input.trim().substring(0, 500);
    setInput('');
    await supabase.from('messages').insert({
      room_id: roomId,
      sender_name: user.name,
      sender_emoji: user.emoji,
      content,
      type: 'chat',
    });
  };

  const handleShip = async () => {
    if (!roomId || shipping) return;
    setShipping(true);

    // System message
    await supabase.from('messages').insert({
      room_id: roomId,
      sender_name: 'system',
      sender_emoji: '',
      content: '🚀 Shipping in progress... reading your conversation',
      type: 'system',
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-site', {
        body: { room_id: roomId },
      });

      if (error) throw error;

      if (data?.error) {
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_name: 'system',
          sender_emoji: '',
          content: data.error,
          type: 'system',
        });
      } else if (data?.deployed_url) {
        setRoomData({ shipped: true, deployed_url: data.deployed_url });
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_name: 'system',
          sender_emoji: '',
          content: `🎉 ${data.product_name} is live!\n${data.deployed_url}`,
          type: 'ship-success',
        });
      } else if (data?.html) {
        // No Vercel token — show preview with HTML blob
        const blob = new Blob([data.html], { type: 'text/html' });
        const previewUrl = URL.createObjectURL(blob);
        setRoomData({ shipped: true, deployed_url: previewUrl });
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_name: 'system',
          sender_emoji: '',
          content: `🎉 ${data.product_name} is ready! (Preview — add Vercel token for live deploy)\n${previewUrl}`,
          type: 'ship-success',
        });
      }
    } catch (e) {
      console.error(e);
      await supabase.from('messages').insert({
        room_id: roomId,
        sender_name: 'system',
        sender_emoji: '',
        content: '😅 Something went wrong while shipping. Try again!',
        type: 'system',
      });
    } finally {
      setShipping(false);
    }
  };

  if (!user) {
    return <UserSetup onComplete={(name, emoji) => setChatUser({ name, emoji })} />;
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="glass-card rounded-none border-x-0 border-t-0 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-primary font-bold text-sm">
            Lazy Chatter 🚀
          </button>
          <span className="text-muted-foreground text-sm">Room: {roomId}</span>
          {roomData?.shipped && (
            <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Live
            </span>
          )}
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast('Link copied! 🔗');
          }}
          className="text-primary text-sm font-medium hover:opacity-80"
        >
          Copy Link
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <p key={msg.id} className="text-center text-sm text-muted-foreground py-1">
                {msg.content}
              </p>
            );
          }

          if (msg.type === 'ship-success') {
            const lines = msg.content.split('\n');
            const title = lines[0];
            const url = lines[1];
            return (
              <div key={msg.id} className="flex justify-center py-4">
                <div className="glass-card p-6 max-w-sm w-full text-center space-y-3">
                  <p className="text-lg font-bold text-foreground">{title}</p>
                  {url && (
                    <>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm underline break-all"
                      >
                        {url}
                      </a>
                      <div className="flex gap-2 justify-center pt-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90"
                        >
                          Visit Site 🔗
                        </a>
                        <button
                          disabled
                          className="bg-secondary text-muted-foreground px-4 py-2 rounded-xl text-sm cursor-not-allowed"
                          title="Coming soon"
                        >
                          Edit ✏️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          }

          const isMe = msg.sender_name === user.name && msg.sender_emoji === user.emoji;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1 mb-1 text-xs text-muted-foreground ${isMe ? 'justify-end' : ''}`}>
                  <span>{msg.sender_emoji}</span>
                  <span>{msg.sender_name}</span>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/10 text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
                <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? 'text-right' : ''}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="glass-card rounded-none border-x-0 border-b-0 px-4 py-3 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your idea..."
          maxLength={500}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm"
        />
        <button
          onClick={sendMessage}
          className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
        >
          Send
        </button>
      </div>

      {/* SHIP IT button */}
      <button
        onClick={handleShip}
        disabled={shipping || roomData?.shipped === true}
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-primary to-cyan text-primary-foreground font-bold text-xs pulse-glow hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed z-50 flex items-center justify-center"
      >
        {shipping ? '...' : 'SHIP\nIT 🚀'}
      </button>
    </div>
  );
};

export default Room;
