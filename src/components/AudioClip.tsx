import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/** Audio from the question bank (e.g. English listening), stored with the figures. */
export default function AudioClip({ id, label }: { id: string; label: string }) {
  const clip = useLiveQuery(() => db.figures.get(id), [id]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!clip) return;
    const u = URL.createObjectURL(new Blob([clip.data], { type: clip.mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [clip]);
  if (clip === null) return <p className="text-sm text-warning">ไม่พบไฟล์เสียง</p>;
  if (!url) return null;
  return <audio controls preload="metadata" src={url} aria-label={label} className="w-full" />;
}
