import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div className="container py-16 text-center max-w-md">
      <div className="font-serif text-6xl italic text-citrus-500/70">404</div>
      <h1 className="mt-2 font-serif text-3xl">Wide ball</h1>
      <p className="text-muted-foreground mt-2">
        That link didn't match anything we could find. Let's get you back on court.
      </p>
      <Button asChild variant="accent" className="mt-5">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
