const emojis = ['🚀', '💡', '🔥', '⚡️', '✨'];

const FloatingEmojis = () => {
  const items = Array.from({ length: 15 }, (_, i) => ({
    emoji: emojis[i % emojis.length],
    left: `${(i * 17 + 5) % 95}%`,
    size: `${1.2 + (i % 3) * 0.8}rem`,
    duration: `${12 + (i % 5) * 4}s`,
    delay: `${(i * 1.3) % 8}s`,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {items.map((item, i) => (
        <span
          key={i}
          className="floating-emoji"
          style={{
            left: item.left,
            fontSize: item.size,
            animationDuration: item.duration,
            animationDelay: item.delay,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
};

export default FloatingEmojis;
