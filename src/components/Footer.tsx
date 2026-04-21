export function Footer() {
  return (
    <footer className="mt-10 border-t border-border/60 py-6 text-center text-xs text-muted-foreground/80 safe-b">
      Powered by{' '}
      <a
        href="https://coreaxisdev.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:text-foreground hover:underline transition-colors"
      >
        Core Axis Development
      </a>
    </footer>
  );
}
