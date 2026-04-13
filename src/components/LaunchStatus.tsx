import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Progress = {
  logo_done: boolean;
  waitlist_enabled: boolean;
  shared: boolean;
  first_signup: boolean;
};

type Props = {
  roomId: string;
  deployedUrl: string | null;
  productName?: string;
  onInsertCommand: (cmd: string) => void;
};

const ProgressRing = ({ percent }: { percent: number }) => {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width="52" height="52" className="transform -rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke="url(#ring-gradient)" strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <defs>
        <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7fff00" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
      </defs>
      <text
        x="26" y="26"
        textAnchor="middle" dominantBaseline="central"
        className="fill-foreground text-[11px] font-bold"
        transform="rotate(90, 26, 26)"
      >
        {percent}%
      </text>
    </svg>
  );
};

const LaunchStatus = ({ roomId, deployedUrl, productName, onInsertCommand }: Props) => {
  const [collapsed, setCollapsed] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    logo_done: false,
    waitlist_enabled: false,
    shared: false,
    first_signup: false,
  });
  const [signupCount, setSignupCount] = useState(0);

  // Load progress
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('room_progress')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();

      if (data) {
        setProgress({
          logo_done: data.logo_done,
          waitlist_enabled: data.waitlist_enabled,
          shared: data.shared,
          first_signup: data.first_signup,
        });
      } else {
        // Create progress row
        await supabase.from('room_progress').insert({ room_id: roomId });
      }
    };
    load();
  }, [roomId]);

  // Load signup count
  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('waitlist_emails')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);
      setSignupCount(count ?? 0);
    };
    load();

    // Realtime for new signups
    const channel = supabase
      .channel(`waitlist-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waitlist_emails', filter: `room_id=eq.${roomId}` },
        () => {
          setSignupCount((prev) => prev + 1);
          if (!progress.first_signup) {
            updateProgress('first_signup', true);
            toast('✅ First signup! 🔥');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, progress.first_signup]);

  const updateProgress = async (key: keyof Progress, value: boolean) => {
    setProgress((prev) => ({ ...prev, [key]: value }));
    await supabase
      .from('room_progress')
      .update({ [key]: value })
      .eq('room_id', roomId);
  };

  const handleShare = async (type: 'copy' | 'twitter' | 'qr') => {
    if (!deployedUrl) return;
    const name = productName || 'our idea';

    if (type === 'copy') {
      await navigator.clipboard.writeText(deployedUrl);
      toast('Link copied! 🔗');
    } else if (type === 'twitter') {
      const text = encodeURIComponent(`we just shipped ${name} in 30 seconds 🚀 ${deployedUrl}`);
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    } else if (type === 'qr') {
      window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(deployedUrl)}`, '_blank');
    }

    if (!progress.shared) {
      updateProgress('shared', true);
      toast('✅ Shared with the world!');
    }
  };

  // Calculate completion
  const items = [
    { done: true }, // ship always done
    { done: progress.logo_done },
    { done: progress.waitlist_enabled },
    { done: progress.shared },
    { done: progress.first_signup },
  ];
  const freeTotal = items.length;
  const freeDone = items.filter((i) => i.done).length;
  const percent = Math.round((freeDone / freeTotal) * 100);
  const allFreeDone = freeDone === freeTotal;

  const [showShareMenu, setShowShareMenu] = useState(false);

  const checklist = [
    {
      status: '✅' as const,
      label: 'Ship your idea',
      action: undefined,
    },
    {
      status: (progress.logo_done ? '✅' : '⬜') as const,
      label: 'Add a logo',
      action: () => onInsertCommand('/logo'),
    },
    {
      status: (progress.waitlist_enabled ? '✅' : '⬜') as const,
      label: 'Collect emails',
      action: () => onInsertCommand('/waitlist'),
    },
    {
      status: (progress.shared ? '✅' : '⬜') as const,
      label: 'Share it',
      action: () => setShowShareMenu(!showShareMenu),
    },
    {
      status: (progress.first_signup ? '✅' : '⬜') as const,
      label: progress.first_signup ? `Get your first signup · ${signupCount} signups 🔥` : 'Get your first signup',
      action: undefined,
      auto: true,
    },
    {
      status: '🔒' as const,
      label: 'Connect a domain',
      pro: true,
    },
    {
      status: '🔒' as const,
      label: 'Get a pitch deck',
      pro: true,
    },
  ];

  const commands = [
    { label: '/remix', desc: 'Remix the design' },
    { label: '/roast', desc: 'Roast my landing page' },
    { label: '/logo', desc: 'Generate a logo' },
  ];

  return (
    <div className="mx-4 mt-2 mb-1">
      <div className="glass-card overflow-hidden transition-all duration-300">
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ProgressRing percent={percent} />
            <span className="font-bold text-foreground text-sm">🚀 Launch Status</span>
          </div>
          <span className="text-muted-foreground text-xs">{collapsed ? '▼' : '▲'}</span>
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="px-4 pb-4 space-y-3">
            {/* Checklist */}
            <div className="space-y-1.5">
              {checklist.map((item, i) => (
                <div key={i}>
                  <button
                    onClick={item.pro ? () => toast('🔒 Upgrade to Pro to unlock this feature!') : item.action}
                    disabled={item.status === '✅' || item.auto}
                    className={`w-full flex items-center gap-2.5 text-left text-sm py-1.5 px-2 rounded-lg transition-colors ${
                      item.status === '✅'
                        ? 'text-muted-foreground'
                        : item.pro
                        ? 'text-muted-foreground/60 cursor-pointer hover:bg-white/5'
                        : item.auto
                        ? 'text-muted-foreground cursor-default'
                        : 'text-foreground hover:bg-white/5 cursor-pointer'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{item.status}</span>
                    <span className={item.status === '✅' ? 'line-through' : ''}>
                      {item.label}
                    </span>
                    {item.pro && (
                      <span className="text-[10px] font-semibold bg-[#ff3cac]/20 text-[#ff3cac] px-1.5 py-0.5 rounded-full uppercase">
                        Pro
                      </span>
                    )}
                  </button>

                  {/* Share submenu */}
                  {item.label.startsWith('Share') && showShareMenu && item.status !== '✅' && (
                    <div className="ml-8 mt-1 flex gap-2">
                      <button
                        onClick={() => handleShare('copy')}
                        className="text-xs bg-white/5 border border-white/10 text-foreground px-3 py-1.5 rounded-full hover:bg-white/10 transition-all"
                      >
                        📋 Copy link
                      </button>
                      <button
                        onClick={() => handleShare('twitter')}
                        className="text-xs bg-white/5 border border-white/10 text-foreground px-3 py-1.5 rounded-full hover:bg-white/10 transition-all"
                      >
                        𝕏 Post
                      </button>
                      <button
                        onClick={() => handleShare('qr')}
                        className="text-xs bg-white/5 border border-white/10 text-foreground px-3 py-1.5 rounded-full hover:bg-white/10 transition-all"
                      >
                        📱 QR Code
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* All free done */}
            {allFreeDone && (
              <div className="bg-gradient-to-r from-[#7fff00]/10 to-[#00d4ff]/10 border border-[#7fff00]/20 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-bold text-foreground">
                  🎉 You're officially launched!
                </p>
                <button
                  onClick={() => toast('🔒 Pro features coming soon!')}
                  className="text-xs text-[#ff3cac] font-medium mt-1 hover:underline"
                >
                  Upgrade to keep building →
                </button>
              </div>
            )}

            {/* Command hints */}
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-muted-foreground mb-2">💡 Try these</p>
              <div className="flex flex-wrap gap-2">
                {commands.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => onInsertCommand(cmd.label)}
                    className="text-xs bg-white/5 border border-white/10 text-foreground px-3 py-1.5 rounded-full hover:bg-white/10 hover:border-white/20 transition-all"
                    title={cmd.desc}
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaunchStatus;
