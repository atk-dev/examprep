import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Maximize2, X } from 'lucide-react';
import { db } from '../db/db';
import { ICON } from './ui';

/** A figure from the question bank, loaded from IndexedDB; tap to view full screen. */
export default function FigureImage({ id, alt, inline = false }: { id: string; alt: string; inline?: boolean }) {
  const fig = useLiveQuery(() => db.figures.get(id), [id]);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!fig) return;
    const u = URL.createObjectURL(new Blob([fig.data], { type: fig.mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [fig]);
  if (fig === undefined) return <div className="h-32 animate-pulse rounded-2xl bg-muted" aria-hidden />;
  if (!fig || !url) return <p className="rounded-2xl bg-warning-bg p-3 text-sm text-warning">ไม่พบรูปประกอบ ดูในหนังสือ</p>;
  if (inline) return <img src={url} alt={alt} className="max-h-48 w-auto max-w-full rounded-xl bg-white object-contain" />;
  return (
    <>
      <button className="group relative block w-full overflow-hidden rounded-2xl border-2 border-border bg-white" onClick={() => setZoom(true)} aria-label={`ขยาย${alt}`}>
        <img src={url} alt={alt} className="mx-auto max-h-80 w-auto max-w-full object-contain" />
        <span className="absolute right-2 bottom-2 grid h-9 w-9 place-items-center rounded-full bg-fg/70 text-white" aria-hidden>
          <Maximize2 size={ICON.sm} />
        </span>
      </button>
      {zoom && (
        <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50 flex flex-col bg-black/90 p-2" onClick={() => setZoom(false)}>
          <button className="btn-ghost ml-auto h-11 w-11 p-0" onClick={() => setZoom(false)} aria-label="ปิดรูป" autoFocus>
            <X size={ICON.md} aria-hidden />
          </button>
          <div className="flex flex-1 items-center justify-center overflow-auto">
            <img src={url} alt={alt} className="max-w-none bg-white" style={{ width: 'min(100%, 1000px)' }} />
          </div>
        </div>
      )}
    </>
  );
}
