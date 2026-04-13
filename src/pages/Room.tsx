import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import UserSetup from '@/components/UserSetup';
import LaunchStatus from '@/components/LaunchStatus';
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

  // Check if room is saved
  useEffect(() => {
    if (!authUser || !roomId) return;
    const check = async () => {
      const { data } = await supabase
        .from('saved_rooms')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('room_id', roomId)
        .maybeSingle();
      setIsSaved(!!data);
    };
    check();
  }, [authUser, roomId]);

  const toggleSave = async () => {
    if (!authUser) {
      toast('Sign in to save rooms', { action: { label: 'Sign In', onClick: () => navigate('/auth') } });
      return;
    }
    if (!roomId) return;
    if (isSaved) {
      await supabase.from('saved_rooms').delete().eq('user_id', authUser.id).eq('room_id', roomId);
      setIsSaved(false);
      toast('Room unsaved');
    } else {
      await supabase.from('saved_rooms').insert({ user_id: authUser.id, room_id: roomId });
      setIsSaved(true);
      toast('Room saved! ⭐');
    }
  };

  // Load messages & subscribe to realtime
  useEffect(() => {
    if (!roomId || !chatUser) return;

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
        content: `${chatUser.emoji} ${chatUser.name} joined the room`,
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
  }, [roomId, chatUser]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !chatUser || !roomId) return;
    const content = input.trim().substring(0, 500);
    setInput('');

    // Handle commands
    if (content.startsWith('/')) {
      await handleCommand(content);
      return;
    }

    await supabase.from('messages').insert({
      room_id: roomId,
      sender_name: chatUser.name,
      sender_emoji: chatUser.emoji,
      content,
      type: 'chat',
    });
  };

  const handleCommand = async (cmd: string) => {
    if (!roomId) return;
    const command = cmd.toLowerCase().trim();

    if (command === '/analytics') {
      await handleAnalytics();
    } else if (command === '/emails') {
      await handleEmails();
    } else if (command === '/roast') {
      await handleRoast();
    } else if (command === '/remix') {
      await handleRemix();
    } else if (command === '/waitlist') {
      await handleWaitlist();
    } else if (command === '/logo') {
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: '🎨 Logo generation coming soon! For now, describe your logo idea in chat and we\'ll include it in the next ship.',
        type: 'system',
      });
    } else {
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: `❓ Unknown command: ${cmd}. Try /analytics, /emails, /roast, /remix, or /waitlist`,
        type: 'system',
      });
    }
  };

  const handleAnalytics = async () => {
    if (!roomId) return;
    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '📊 Fetching analytics...', type: 'system',
    });

    const { data: views } = await supabase
      .from('page_views').select('*').eq('room_id', roomId);
    const { count: signupCount } = await supabase
      .from('waitlist_emails').select('*', { count: 'exact', head: true }).eq('room_id', roomId);

    const totalViews = views?.length ?? 0;
    const uniqueReferrers = [...new Set((views || []).map(v => v.referrer).filter(Boolean))];
    const topReferrers = uniqueReferrers.slice(0, 5).map(r => `  • ${r}`).join('\n') || '  • Direct traffic';

    const analyticsContent = `📊 Analytics\n👀 ${totalViews} total views\n📧 ${signupCount ?? 0} waitlist signups\n🔗 Top referrers:\n${topReferrers}`;

    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: analyticsContent, type: 'analytics',
    });
  };

  const handleEmails = async () => {
    if (!roomId) return;
    const { data: emails } = await supabase
      .from('waitlist_emails').select('*').eq('room_id', roomId).order('created_at', { ascending: false });

    if (!emails || emails.length === 0) {
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: '📧 No waitlist signups yet. Enable waitlist and share your site!', type: 'system',
      });
      return;
    }

    const emailList = emails.map(e => e.email).join('\n');
    const newest = emails[0];
    const content = `📧 Waitlist Emails (${emails.length} total)\nNewest: ${newest.email} (${new Date(newest.created_at).toLocaleDateString()})\n---\n${emailList}`;

    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content, type: 'emails',
    });
  };

  const handleRoast = async () => {
    if (!roomId) return;
    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '🔥 Getting roasted...', type: 'system',
    });

    try {
      const { data, error } = await supabase.functions.invoke('roast', {
        body: { room_id: roomId },
      });
      if (error) throw error;

      if (data?.error) {
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: data.error, type: 'system',
        });
      } else {
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: data.roast, type: 'roast',
        });
      }
    } catch (e) {
      console.error(e);
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: '😅 Roast failed. Try again!', type: 'system',
      });
    }
  };

  const handleRemix = async () => {
    if (!roomId || shipping) return;
    setShipping(true);

    const styles = ['cyberpunk neon', 'retro pixel art', 'minimal zen', 'Y2K aesthetic', 'brutalist'];
    const style = styles[Math.floor(Math.random() * styles.length)];

    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: `🎨 Remixing with ${style} vibes...`, type: 'system',
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-site', {
        body: { room_id: roomId, remix_style: style },
      });
      if (error) throw error;

      if (data?.error) {
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: data.error, type: 'system',
        });
      } else if (data?.deployed_url) {
        setRoomData({ shipped: true, deployed_url: data.deployed_url });
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: `🎨 Remixed! New vibe: ${style}\n${data.deployed_url}`,
          type: 'ship-success',
        });
      } else if (data?.html) {
        const blob = new Blob([data.html], { type: 'text/html' });
        const previewUrl = URL.createObjectURL(blob);
        setRoomData({ shipped: true, deployed_url: previewUrl });
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: `🎨 Remixed! New vibe: ${style} (Preview)\n${previewUrl}`,
          type: 'ship-success',
        });
      }
    } catch (e) {
      console.error(e);
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: '😅 Remix failed. Try again!', type: 'system',
      });
    } finally {
      setShipping(false);
    }
  };

  const handleWaitlist = async () => {
    if (!roomId) return;
    // Enable waitlist in progress
    await supabase.from('room_progress').update({ waitlist_enabled: true } as any).eq('room_id', roomId);

    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '📧 Waitlist enabled! Next time you ship or remix, the landing page will include a working email signup form.',
      type: 'system',
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

  if (!chatUser) {
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
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSave}
            className={`text-sm font-medium hover:opacity-80 transition-opacity ${isSaved ? 'text-accent' : 'text-muted-foreground'}`}
          >
            {isSaved ? '⭐ Saved' : '☆ Save'}
          </button>
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
      </div>

      {/* Launch Status Panel */}
      {roomData?.shipped && roomId && (
        <LaunchStatus
          roomId={roomId}
          deployedUrl={roomData.deployed_url}
          onInsertCommand={(cmd) => setInput(cmd)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <p key={msg.id} className="text-center text-sm text-muted-foreground py-1 whitespace-pre-wrap">
                {msg.content}
              </p>
            );
          }

          if (msg.type === 'roast') {
            return (
              <div key={msg.id} className="flex justify-center py-4">
                <div className="max-w-md w-full p-5 rounded-2xl bg-[#ff3cac]/10 border border-[#ff3cac]/30 space-y-2">
                  <p className="text-sm font-bold text-[#ff3cac]">💀 Roast</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.type === 'analytics') {
            return (
              <div key={msg.id} className="flex justify-center py-4">
                <div className="glass-card max-w-md w-full p-5 space-y-2">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.type === 'emails') {
            const lines = msg.content.split('\n');
            const header = lines.slice(0, 3).join('\n');
            const emailList = lines.slice(3).filter(l => l && l !== '---').join(', ');
            return (
              <div key={msg.id} className="flex justify-center py-4">
                <div className="glass-card max-w-md w-full p-5 space-y-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{header}</p>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground break-all">{emailList}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(emailList);
                      toast('Emails copied! 📋');
                    }}
                    className="text-xs bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-lg hover:opacity-90"
                  >
                    Copy All 📋
                  </button>
                </div>
              </div>
            );
          }

          if (msg.type === 'ship-success') {
            const lines = msg.content.split('\n');
            const title = lines[0];
            const url = lines[1];
            return (
              <div key={msg.id} className="flex justify-center py-4">
                <div className="glass-card p-6 max-w-md w-full text-center space-y-4">
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

                  {/* Next steps */}
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <p className="text-xs text-muted-foreground mb-3">What's next? 🚀</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        { label: '🎨 Change the design', prompt: 'make the design more colorful and bold' },
                        { label: '📝 Add a signup form', prompt: 'add an email signup form to the landing page' },
                        { label: '📊 Add pricing section', prompt: 'add a pricing section with 3 tiers' },
                        { label: '💬 Add testimonials', prompt: 'add a testimonials section with fake reviews' },
                        { label: '🔄 Start fresh', prompt: '' },
                      ].map((action) => (
                        <button
                          key={action.label}
                          onClick={() => {
                            if (action.prompt) {
                              setInput(action.prompt);
                            } else {
                              const newId = Math.random().toString(36).substring(2, 8);
                              navigate(`/room/${newId}`);
                            }
                          }}
                          className="text-xs bg-white/5 border border-white/10 text-foreground px-3 py-1.5 rounded-full hover:bg-white/10 hover:border-white/20 transition-all"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const isMe = msg.sender_name === chatUser.name && msg.sender_emoji === chatUser.emoji;
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
