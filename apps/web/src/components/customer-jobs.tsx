'use client';
import Link from 'next/link';
import { JobStatusBadge, useProfile } from './services-ui';
import { Card } from './ui';
import { date, money } from '@/lib/format';

export function CustomerJobs({ jobs }: { jobs: any[] }) {
  const p = useProfile();
  return <Card title={p.job.plural}>
    {!jobs.length ? <p className="text-sm text-ink-muted">Este cliente aún no tiene {p.job.plural.toLowerCase()}.</p> : <div className="divide-y divide-line">{jobs.map((j) =>
      <Link key={j.id} href={`/trabajos/${j.id}`} className="py-2.5 flex items-center gap-3 hover:bg-sand-50 -mx-2 px-2 rounded-lg">
        <div className="flex-1 min-w-0"><p className="text-sm truncate">#{j.number} · {j.title}</p><p className="text-xs text-ink-muted">{date(j.createdAt ?? j.updatedAt)}{Number(j.total) ? ` · ${money(j.total)}` : ''}</p></div>
        <JobStatusBadge status={j.status} />
      </Link>)}</div>}
  </Card>;
}
