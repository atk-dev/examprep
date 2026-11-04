import { BookOpen, ChartColumn } from 'lucide-react';
import { PageTitle, Segmented } from '../components/ui';
import { Link, useSearchParams } from 'react-router-dom';
import Stats from './Stats';
import PlanCalendar from './PlanCalendar';
import Scores from './Scores';
import { LEVEL_STYLE, ProgressBar, pct } from '../components/ui';
import type { AppData } from '../hooks/useAppData';

export default function Progress({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  type Tab = 'plan' | 'topics' | 'scores' | 'stats';
  const raw = params.get('tab') as Tab | null;
  const tabs: { id: Tab; label: string }[] = data.planMode
    ? [{ id: 'plan', label: 'ปฏิทิน' }, { id: 'topics', label: 'หัวข้อ' }, { id: 'scores', label: 'คะแนน' }, { id: 'stats', label: 'สถิติ' }]
    : [{ id: 'topics', label: 'รายหัวข้อ' }, { id: 'stats', label: 'สถิติ' }];
  const tab: Tab = raw && tabs.some((t) => t.id === raw) ? raw : tabs[0].id;
  return (
    <>
      <PageTitle icon={ChartColumn}>ความคืบหน้า</PageTitle>
      <Segmented
        label="มุมมอง"
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        options={tabs}
      />
      {tab === 'stats' ? <Stats data={data} /> : tab === 'plan' ? <PlanCalendar data={data} /> : tab === 'scores' ? <Scores data={data} /> : <TopicList data={data} />}
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
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: p.subject.color }} />
              {p.subject.name}
            </h2>
            <span className="text-sm text-muted-fg">ถูกครั้งแรก {pct(p.accuracy)}</span>
          </div>
          <ProgressBar value={p.total ? p.done / p.total : 0} color={p.subject.color} />
          <div className="text-xs text-muted-fg">
            {p.done}/{p.total} ข้อ{p.open > 0 && ` · รอทวน ${p.open} ข้อ`}
          </div>
          <ul className="divide-y divide-muted">
            {p.topics.map((t) => (
              <li key={t.topic.id}>
                <Link to={`/log?topic=${t.topic.id}`} className="flex min-h-12 items-center gap-2 py-2">
                  <span className="flex-1">
                    {t.topic.summaryRead && <BookOpen size={14} className="mr-1 inline text-primary" aria-label="อ่านสรุปแล้ว" />}
                    {t.topic.name}
                    <span className="ml-1 text-xs text-muted-fg">{t.done}/{t.topic.problemCount}</span>
                  </span>
                  {t.accuracy !== null && <span className="text-xs text-muted-fg">{pct(t.accuracy)}</span>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_STYLE[t.level].cls}`}>{LEVEL_STYLE[t.level].label}</span>
                </Link>
              </li>
            ))}
            {!p.topics.length && <li className="py-2 text-sm text-muted-fg">ยังไม่มีหัวข้อ</li>}
          </ul>
        </section>
      ))}
    </>
  );
}
