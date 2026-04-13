import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  feature?: string;
};

const ProUpgradeModal = ({ open, onClose, feature }: Props) => {
  if (!open) return null;

  const features = [
    'Unlimited ships',
    'Unlimited remixes',
    'Unlimited logos',
    '/build command — turn ideas into apps',
    'Custom domains',
    'Pitch deck generator',
    'Advanced analytics',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card max-w-sm w-full mx-4 p-8 space-y-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Go Pro 🚀</h2>
          <p className="text-muted-foreground text-sm mt-1">$12/mo — unlimited everything</p>
          {feature && (
            <p className="text-xs text-[#ff3cac] mt-2">
              🔒 {feature}
            </p>
          )}
        </div>

        <div className="space-y-2 text-left">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-foreground">
              <span className="text-primary">✓</span>
              <span>{f}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            // For now, show coming soon. In production, this would link to Polar checkout
            onClose();
            // toast would be called from parent
          }}
          className="w-full bg-gradient-to-r from-primary to-[hsl(var(--cyan))] text-primary-foreground font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity"
        >
          Upgrade Now →
        </button>

        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};

export default ProUpgradeModal;
