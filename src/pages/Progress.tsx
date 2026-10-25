import { Link, useSearchParams } from 'react-router-dom';
import Stats from './Stats';
import { LEVEL_STYLE, ProgressBar, pct } from '../components/ui';
import type { AppData } from '../hooks/useAppData';

export default function Progress({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'stats' ? 'stats' : 'topics';
  return (
    <>
      <h1 className="text-xl font-bold">📊 ความคืบหน้า</h1>
      <div className="grid grid-cols-2 rounded-xl bg-slate-200 p-1 text-sm">
        {(['topics', 'stats'] as const).map((t) => (
          <button
            key={t}
            className={`rounded-lg py-1.5 font-semibold ${tab === t ? 'bg-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setParams(t === 'stats' ? { tab: 'stats' } : {}, { replace: true })}
          >
            {t === 'topics' ? 'รายหัวข้อ' : 'สถิติ'}
          </button>
        ))}
      </div>
      {tab === 'stats' ? <Stats data={data} /> : <TopicList data={data} />}
    </>
  );
}

function TopicList({ data }: { data: AppData }) {
  return (
    <>
      <div className="card">
        <div className="flex justify-between text-sm">
          <span>ทำแล้ว {data.done} / {data.total} ข้อ</span>
          <b>{pct(data.total ? data.done / data.total : 0)}</b>
        </div>
        <ProgressBar className="mt-2" value={data.total ? data.done / data.total : 0} />
      </div>
      {data.progress.map((p) => (
        <section key={p.subject.id} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: p.subject.color }} />
              {p.subject.name}
            </h2>
            <span className="text-sm text-slate-500">ถูกครั้งแรก {pct(p.accuracy)}</span>
          </div>
          <ProgressBar value={p.total ? p.done / p.total : 0} color={p.subject.color} />
          <div className="text-xs text-slate-500">
            {p.done}/{p.total} ข้อ{p.open > 0 && ` · รอทวน ${p.open} ข้อ`}
          </div>
          <ul className="divide-y divide-slate-100">
            {p.topics.map((t) => (
              <li key={t.topic.id}>
                <Link to={`/log?topic=${t.topic.id}`} className="flex items-center gap-2 py-2">
                  <span className="flex-1">
                    {t.topic.summaryRead && '📖 '}
                    {t.topic.name}
                    <span className="ml-1 text-xs text-slate-400">{t.done}/{t.topic.problemCount}</span>
                  </span>
                  {t.accuracy !== null && <span className="text-xs text-slate-500">{pct(t.accuracy)}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[t.level].cls}`}>{LEVEL_STYLE[t.level].label}</span>
                </Link>
              </li>
            ))}
            {!p.topics.length && <li className="py-2 text-sm text-slate-400">ยังไม่มีหัวข้อ</li>}
          </ul>
        </section>
      ))}
    </>
  );
}
