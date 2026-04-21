import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, QrCode, Share2 } from 'lucide-react';
import type { Tournament } from '@/lib/types';
import { Button } from './ui/Button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from './ui/Sheet';

export function ShareSheet({ tournament }: { tournament: Tournament }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const base = `${window.location.origin}${import.meta.env.BASE_URL}t`;
  const viewUrl = `${base}/${tournament.token}`;
  const editUrl = `${base}/${tournament.edit_token}`;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(viewUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#0b0b0c', light: '#ffffff' },
    }).then(setQr).catch(console.error);
  }, [open, viewUrl]);

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} link copied.`);
    } catch {
      toast.error("Couldn't copy. Long-press the URL to copy manually.");
    }
  };

  const share = async (url: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ url, title });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy(url, title);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="subtle" size="sm">
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Share tournament</SheetTitle>
          <SheetDescription>
            Spectator link is read-only. Organizer link gives full edit access — only share it with
            co-organizers.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4">
          <UrlBlock
            label="Spectator (read-only)"
            url={viewUrl}
            onCopy={() => copy(viewUrl, 'Spectator')}
            onShare={() => share(viewUrl, tournament.name)}
          />
          <UrlBlock
            label="Organizer (edit)"
            url={editUrl}
            onCopy={() => copy(editUrl, 'Organizer')}
            onShare={() => share(editUrl, `${tournament.name} — organizer`)}
            danger
          />
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <span className="text-sm font-medium">Venue QR code (spectator)</span>
            </div>
            {qr ? (
              <img
                src={qr}
                alt="QR code"
                className="mx-auto my-2 h-56 w-56 rounded-lg border border-border bg-white p-3"
              />
            ) : (
              <div className="mx-auto my-2 h-56 w-56 animate-pulse rounded-lg bg-muted" />
            )}
            <p className="text-xs text-muted-foreground text-center">
              Point a phone camera here to open the spectator view.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function UrlBlock({
  label,
  url,
  onCopy,
  onShare,
  danger,
}: {
  label: string;
  url: string;
  onCopy: () => void;
  onShare: () => void;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        danger ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-background/50'
      }`}
    >
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mb-3 truncate font-mono text-xs">{url}</div>
      <div className="flex gap-2">
        <Button variant="subtle" size="sm" onClick={onCopy} className="flex-1">
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Button variant="accent" size="sm" onClick={onShare} className="flex-1">
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>
    </div>
  );
}
