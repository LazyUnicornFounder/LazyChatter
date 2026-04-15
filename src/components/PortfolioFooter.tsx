const products = [
  { name: "Autonomous Capitalism", url: "https://autonomouscapitalism.com" },
  { name: "Breaking Muse", url: "https://breakingmuse.ai" },
  { name: "Lazy Canvas", url: "https://lazycanvas.com" },
  { name: "Lazy Cloud", url: "https://lazycloud.ai" },
  { name: "Lazy Exit", url: "https://lazyexit.com" },
  { name: "Lazy Tones", url: "https://lazytones.com" },
  { name: "Lazy Rent-A-Biz", url: "https://lazyrentabiz.com" },
  { name: "Lazy Academy", url: "https://lazyacademy.com" },
  { name: "Lazy Sands", url: "https://lazysands.com" },
  { name: "Lazy Decacorn", url: "https://lazydecacorn.com" },
  { name: "Lazy Chatter", url: "https://lazychatter.com" },
  { name: "Lazy LLC", url: "https://lazyllc.com" },
  { name: "Solo Unicorn League", url: "https://solounicornleague.com" },
];

const PortfolioFooter = () => (
  <footer className="border-t border-border/20 py-8 px-6 lg:px-20">
    <div className="max-w-6xl mx-auto">
      <p className="text-muted-foreground/60 text-xs uppercase tracking-wider font-semibold mb-3">
        A Lazy Founder Ventures product
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {products.map((p) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/50 text-xs hover:text-foreground transition-colors"
          >
            {p.name}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground/40">
        <a href="https://lazyfounderventures.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Portfolio</a>
        <a href="https://github.com/LazyUnicornFounder" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
        <a href="https://x.com/SoloUnicorn" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter/X</a>
      </div>
    </div>
  </footer>
);

export default PortfolioFooter;
