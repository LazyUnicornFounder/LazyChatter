import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import UserSetup from '@/components/UserSetup';
import LaunchStatus from '@/components/LaunchStatus';
import ProUpgradeModal from '@/components/ProUpgradeModal';
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

// Free usage limits
const FREE_LIMITS = { ships: 3, remixes: 3, logos: 2 };

const getUsage = () => {
  try {
    return JSON.parse(localStorage.getItem('lazyship_usage') || '{}');
  } catch { return {}; }
};
const incrementUsage = (key: string) => {
  const u = getUsage();
  u[key] = (u[key] || 0) + 1;
  localStorage.setItem('lazyship_usage', JSON.stringify(u));
  return u[key];
};
const getUsageCount = (key: string) => getUsage()[key] || 0;
const getAiModeStorageKey = (roomId?: string) => `lazyship_ai_mode_${roomId ?? 'global'}`;

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [chatUser, setChatUser] = useState<{ name: string; emoji: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [shipping, setShipping] = useState(false);
  const [roomData, setRoomData] = useState<{ shipped: boolean; deployed_url: string | null } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [proModal, setProModal] = useState<{ open: boolean; feature?: string }>({ open: false });
  const [awaitingLogoVibe, setAwaitingLogoVibe] = useState(false);
  const [awaitingBuildDesc, setAwaitingBuildDesc] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const { user: authUser } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasShownInvite = useRef(false);

  const COMMANDS_LIST = [
    { cmd: '/logo', desc: 'Generate an AI logo for your site' },
    { cmd: '/remix', desc: 'Redesign your site with a random aesthetic' },
    { cmd: '/roast', desc: 'Get a brutal (but helpful) startup roast' },
    { cmd: '/waitlist', desc: 'Enable email collection on your site' },
    { cmd: '/analytics', desc: 'View page views, signups & referrers' },
    { cmd: '/emails', desc: 'List all waitlist signups with copy button' },
    { cmd: '/feedback', desc: 'Add a feedback widget to your site' },
    { cmd: '/build', desc: 'Turn your idea into a real app (Pro)' },
    { cmd: '/update', desc: 'Update your deployed app (Pro)' },
  ];

  // Check localStorage for existing user
  useEffect(() => {
    const name = localStorage.getItem('lazyship_name');
    const emoji = localStorage.getItem('lazyship_emoji');
    if (name && emoji) setChatUser({ name, emoji });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    setAiMode(localStorage.getItem(getAiModeStorageKey(roomId)) === 'true');
  }, [roomId]);

  // Ensure room exists
  const roomReady = useRef(false);
  useEffect(() => {
    if (!roomId) return;
    const ensureRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (!data) {
        await supabase.from('rooms').insert({ id: roomId });
      } else {
        setRoomData({ shipped: data.shipped, deployed_url: data.deployed_url });
      }
      roomReady.current = true;
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

  // Realtime feedback listener
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`feedback-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feedback', filter: `room_id=eq.${roomId}` },
        async (payload: any) => {
          await supabase.from('messages').insert({
            room_id: roomId, sender_name: 'system', sender_emoji: '',
            content: `💬 New feedback: "${payload.new.message}"`,
            type: 'system',
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

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

    // Send join system message — wait for room to exist
    const sendJoin = async () => {
      // Wait for room to be created
      let retries = 0;
      while (!roomReady.current && retries < 20) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
      }
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

  const checkLimit = (key: string, limit: number, featureName: string): boolean => {
    const count = getUsageCount(key);
    if (count >= limit) {
      setProModal({ open: true, feature: `${featureName} — you've used ${count}/${limit} free` });
      return false;
    }
    return true;
  };

  const sendMessage = async () => {
    if (!input.trim() || !chatUser || !roomId) return;
    const content = input.trim().substring(0, 500);
    setInput('');

    // Handle commands
    if (content.startsWith('/')) {
      await handleCommand(content);
      return;
    }

    // If awaiting logo vibe words
    if (awaitingLogoVibe) {
      setAwaitingLogoVibe(false);
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: chatUser.name, sender_emoji: chatUser.emoji,
        content, type: 'chat',
      });
      await generateLogo(content);
      return;
    }

    await supabase.from('messages').insert({
      room_id: roomId,
      sender_name: chatUser.name,
      sender_emoji: chatUser.emoji,
      content,
      type: 'chat',
    });

    // AI copilot auto-reply
    if (aiMode) {
      setAiTyping(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
          body: { room_id: roomId, user_message: content },
        });
        if (error) throw error;
        const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
        if (!reply) throw new Error('Empty AI reply');
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_name: 'AI Copilot',
          sender_emoji: '🤖',
          content: reply,
          type: 'ai-chat',
        });
      } catch (e) {
        console.error('AI chat error:', e);
        await supabase.from('messages').insert({
          room_id: roomId,
          sender_name: 'system',
          sender_emoji: '',
          content: '🤖 AI hit a snag — try again in a sec.',
          type: 'system',
        });
        toast('AI reply failed');
      } finally {
        setAiTyping(false);
      }
    }
  };

  const handleCommand = async (cmd: string) => {
    if (!roomId) return;
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

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
      await handleLogoStart();
    } else if (command === '/build') {
      if (parts[1]?.toLowerCase() === 'go') {
        await handleBuildGo();
      } else {
        await handleBuildStart();
      }
    } else if (command === '/update') {
      const desc = parts.slice(1).join(' ');
      if (desc) {
        await handleUpdate(desc);
      } else {
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: '❓ Usage: /update [description of changes]', type: 'system',
        });
      }
    } else if (command === '/feedback') {
      await handleFeedback();
    } else {
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: `❓ Unknown command: ${cmd}. Try /analytics, /emails, /roast, /remix, /waitlist, /logo, /build, /feedback`,
        type: 'system',
      });
    }
  };

  // ===== LOGO =====
  const handleLogoStart = async () => {
    if (!roomId) return;
    if (!checkLimit('logos', FREE_LIMITS.logos, 'Logo generations')) return;
    setAwaitingLogoVibe(true);
    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: 'describe your vibe in 3 words 🎨', type: 'system',
    });
  };

  const generateLogo = async (vibeWords: string, variation = false) => {
    if (!roomId) return;
    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '🎨 Generating logo...', type: 'system',
    });

    try {
      // Get product name from recent ship messages or room
      const { data: shipMsgs } = await supabase
        .from('messages')
        .select('content')
        .eq('room_id', roomId)
        .eq('type', 'ship-success')
        .order('created_at', { ascending: false })
        .limit(1);

      let productName = 'My Product';
      if (shipMsgs?.[0]) {
        const match = shipMsgs[0].content.match(/🎉\s*(.+?)\s*(is live|is ready)/);
        if (match) productName = match[1];
      }

      const { data, error } = await supabase.functions.invoke('generate-logo', {
        body: { room_id: roomId, product_name: productName, vibe_words: vibeWords, variation },
      });
      if (error) throw error;

      if (data?.error) {
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: data.error, type: 'system',
        });
      } else if (data?.logo_url) {
        incrementUsage('logos');
        // Store vibe words for "Try Again"
        localStorage.setItem('lazyship_last_vibe', vibeWords);

        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: `logo:${data.logo_url}:${vibeWords}`, type: 'logo',
        });
      }
    } catch (e) {
      console.error(e);
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
        content: '😅 Logo generation failed. Try again!', type: 'system',
      });
    }
  };

  const handleUseLogo = async (logoUrl: string) => {
    if (!roomId) return;
    // Update room_progress
    await supabase.from('room_progress').update({ logo_done: true } as any).eq('room_id', roomId);
    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '✅ Logo added! It will appear on your next ship/remix.', type: 'system',
    });
    // Store logo URL for the room
    localStorage.setItem(`lazyship_logo_${roomId}`, logoUrl);
    toast('✅ Logo added!');
  };

  const handleTryAgainLogo = async () => {
    const vibe = localStorage.getItem('lazyship_last_vibe') || 'bold clean modern';
    if (!checkLimit('logos', FREE_LIMITS.logos, 'Logo generations')) return;
    await generateLogo(vibe, true);
  };

  // ===== BUILD =====
  const handleBuildStart = async () => {
    if (!roomId) return;
    // Pro-only check
    setProModal({ open: true, feature: '/build is for Pro members. Upgrade to turn your landing page into a real app' });
  };

  const handleBuildGo = async () => {
    if (!roomId || shipping) return;
    setProModal({ open: true, feature: '/build is for Pro members' });
  };

  const handleUpdate = async (description: string) => {
    if (!roomId) return;
    setProModal({ open: true, feature: '/update is for Pro members' });
  };

  // ===== FEEDBACK =====
  const handleFeedback = async () => {
    if (!roomId || !roomData?.deployed_url) {
      await supabase.from('messages').insert({
        room_id: roomId!, sender_name: 'system', sender_emoji: '',
        content: '📦 Ship your site first before adding a feedback widget!', type: 'system',
      });
      return;
    }

    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '💬 Feedback widget enabled! Next ship/remix will include a floating feedback button.', type: 'system',
    });
    localStorage.setItem(`lazyship_feedback_${roomId}`, 'true');
    toast('💬 Feedback widget enabled!');
  };

  // ===== ANALYTICS =====
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
    if (!checkLimit('remixes', FREE_LIMITS.remixes, 'Remixes')) return;
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
        incrementUsage('remixes');
        setRoomData({ shipped: true, deployed_url: data.deployed_url });
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: `🎨 Remixed! New vibe: ${style}\n${data.deployed_url}`,
          type: 'ship-success',
        });
      } else if (data?.html) {
        incrementUsage('remixes');
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
    await supabase.from('room_progress').update({ waitlist_enabled: true } as any).eq('room_id', roomId);

    await supabase.from('messages').insert({
      room_id: roomId, sender_name: 'system', sender_emoji: '',
      content: '📧 Waitlist enabled! Next time you ship or remix, the landing page will include a working email signup form.',
      type: 'system',
    });
  };

  const handleShip = async () => {
    if (!roomId || shipping) return;
    if (!checkLimit('ships', FREE_LIMITS.ships, 'Ships')) return;
    setShipping(true);

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
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: data.error, type: 'system',
        });
      } else if (data?.deployed_url) {
        incrementUsage('ships');
        setRoomData({ shipped: true, deployed_url: data.deployed_url });
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: `🎉 ${data.product_name} is live!\n${data.deployed_url}`,
          type: 'ship-success',
        });
      } else if (data?.html) {
        incrementUsage('ships');
        const blob = new Blob([data.html], { type: 'text/html' });
        const previewUrl = URL.createObjectURL(blob);
        setRoomData({ shipped: true, deployed_url: previewUrl });
        await supabase.from('messages').insert({
          room_id: roomId, sender_name: 'system', sender_emoji: '',
          content: `🎉 ${data.product_name} is ready! (Preview — add Vercel token for live deploy)\n${previewUrl}`,
          type: 'ship-success',
        });
      }
    } catch (e) {
      console.error(e);
      await supabase.from('messages').insert({
        room_id: roomId, sender_name: 'system', sender_emoji: '',
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
          <span className="text-xs text-muted-foreground" title="Free ships remaining on this device">
            🚀 {getUsageCount('ships')}/{FREE_LIMITS.ships} ships used
          </span>
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

      {/* Solo mode AI banner — show immediately */}
      {!aiMode && (
        <div className="mx-4 mt-2 mb-1">
          <div className="glass-card px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Flying solo?</p>
                <p className="text-xs text-muted-foreground">Chat with AI Copilot to brainstorm your idea</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAiMode(true);
                if (roomId) localStorage.setItem(getAiModeStorageKey(roomId), 'true');
                toast('🤖 AI Copilot activated!');
              }}
              className="bg-gradient-to-r from-[hsl(var(--cyan))] to-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-xs hover:opacity-90 transition-opacity"
            >
              Enable AI
            </button>
          </div>
        </div>
      )}

      {/* AI mode indicator */}
      {aiMode && (
        <div className="mx-4 mt-2 mb-1 flex items-center justify-between glass-card px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="text-xs font-semibold text-[hsl(var(--cyan))]">AI Copilot active</span>
          </div>
          <button
            onClick={() => {
              setAiMode(false);
              if (roomId) localStorage.removeItem(getAiModeStorageKey(roomId));
              toast('AI Copilot disabled');
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Disable
          </button>
        </div>
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

          if (msg.type === 'logo') {
            // Parse logo:url:vibe format
            const parts = msg.content.split(':');
            const logoUrl = parts.slice(1, -1).join(':');
            return (
              <div key={msg.id} className="flex justify-center py-4">
                <div className="glass-card max-w-sm w-full p-5 space-y-4 text-center">
                  <p className="text-sm font-bold text-foreground">🎨 Generated Logo</p>
                  <div className="flex justify-center">
                    <img
                      src={logoUrl}
                      alt="Generated logo"
                      className="w-32 h-32 rounded-2xl object-cover border border-white/10"
                    />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => handleUseLogo(logoUrl)}
                      className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90"
                    >
                      Use This ✅
                    </button>
                    <button
                      onClick={handleTryAgainLogo}
                      className="bg-white/5 border border-white/10 text-foreground font-bold px-4 py-2 rounded-xl text-sm hover:bg-white/10"
                    >
                      Try Again 🔄
                    </button>
                  </div>
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

          // AI copilot messages get special styling
          const isAi = msg.type === 'ai-chat' || msg.sender_name === 'AI Copilot';
          const isMe = !isAi && msg.sender_name === chatUser.name && msg.sender_emoji === chatUser.emoji;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1 mb-1 text-xs text-muted-foreground ${isMe ? 'justify-end' : ''}`}>
                  <span>{msg.sender_emoji}</span>
                  <span>{isAi ? <span className="text-[hsl(var(--cyan))]">{msg.sender_name}</span> : msg.sender_name}</span>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground'
                      : isAi
                      ? 'bg-[hsl(var(--cyan))]/10 border border-[hsl(var(--cyan))]/20 text-foreground'
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
        {/* AI typing indicator */}
        {aiTyping && (
          <div className="flex justify-start">
            <div className="max-w-[75%]">
              <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                <span>🤖</span>
                <span>AI Copilot</span>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[hsl(var(--cyan))]/10 border border-[hsl(var(--cyan))]/20">
                <div className="flex gap-1">
                  <span className="typing-dot w-2 h-2 rounded-full bg-[hsl(var(--cyan))]" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-[hsl(var(--cyan))]" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-[hsl(var(--cyan))]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Commands panel */}
      {showCommands && (
        <div className="px-4 py-3 border-t border-white/10 bg-white/[0.03] backdrop-blur-xl max-h-52 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">⚡ Available Commands</p>
            <button onClick={() => setShowCommands(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="grid gap-1">
            {COMMANDS_LIST.map((c) => (
              <button
                key={c.cmd}
                onClick={() => { setInput(c.cmd); setShowCommands(false); }}
                className="flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <span className="text-sm font-mono font-bold text-primary min-w-[80px]">{c.cmd}</span>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{c.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="glass-card rounded-none border-x-0 border-b-0 px-4 py-3 flex gap-3">
        <button
          onClick={() => setShowCommands(!showCommands)}
          className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${showCommands ? 'bg-primary text-primary-foreground' : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
          title="Show commands"
        >
          /
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={awaitingLogoVibe ? "Enter 3 vibe words (e.g. fast clean bold)..." : "Type your idea or /command..."}
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

      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        open={proModal.open}
        onClose={() => setProModal({ open: false })}
        feature={proModal.feature}
      />
    </div>
  );
};

export default Room;
