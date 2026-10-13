'use client';
import { Check, FileUp, Landmark, Lock, Plus, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, TableWrap, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { METHODS, date, money, todayISO } from '@/lib/format';
import { qs, useApi } from '@/lib/hooks';

export default function BanksPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data: accts, error, reload: reloadAccts } = useApi<any>('/bank-accounts');
  const { data: providers } = useApi<any[]>('/bank-accounts/providers');
  const [status, setStatus] = useState<'' | 'UNMATCHED' | 'MATCHED' | 'IGNORED'>('');
  const { data: txs, reload: reloadTx } = useApi<any[]>(`/bank-transactions${qs({ status })}`);
  const { data: sugg, reload: reloadSugg } = useApi<any[]>('/reconciliations/suggestions');
  const [newAcct, setNewAcct] = useState(false);
  const [importFor, setImportFor] = useState<string | null>(null);
  const [manualFor, setManualFor] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const reloadAll = () => { reloadAccts(); reloadTx(); reloadSugg(); };

  const sync = async (id: string) => {
    setSyncing(id);
    try { const r = await api(`/bank-accounts/${id}/sync`, { method: 'POST' }); toast(`${r.inserted} movimiento(s) simulado(s) nuevo(s)`); reloadAll(); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setSyncing(null); }
  };
  const decide = async (id: string, accept: boolean) => {
    try { await api(`/reconciliations/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' }); toast(accept ? 'Movimiento conciliado' : 'Sugerencia descartada'); reloadAll(); }
    catch (e) { toast((e as Error).message, 'bad'); }
  };
  const ignore = async (id: string) => { await api(`/bank-transactions/${id}`, { method: 'PATCH', body: { status: 'IGNORED' } }); reloadTx(); };

  return (
    <>
      <PageHeader title="Bancos" subtitle="Cuentas, movimientos y conciliación con tus ventas."
        actions={can('banks:write') && <button className="btn-primary" onClick={() => setNewAcct(true)}><Plus className="h-4 w-4" /> Agregar cuenta</button>} />
      {error && <ErrorBox message={error} />}

      <div className="rounded-2xl border border-line bg-sand-100 p-4 mb-5 flex gap-3 text-sm">
        <Lock className="h-4 w-4 text-sand-600 mt-0.5 shrink-0" />
        <p className="text-ink-soft">DREAMS <b>nunca</b> te pedirá ni guardará la contraseña de tu banco. Hoy puedes registrar movimientos o importar el extracto en CSV. La conexión directa requiere un proveedor de Open Finance autorizado y se activará cuando exista ese contrato.</p>
      </div>

      {!accts ? <Loading /> : accts.items.length === 0 ? (
        <Card><Empty icon={<Landmark className="h-5 w-5" />} title="Sin cuentas bancarias" description="Agrega tu cuenta de ahorros, corriente o billetera (Nequi, Daviplata)." action={can('banks:write') && <button className="btn-primary" onClick={() => setNewAcct(true)}>Agregar cuenta</button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
          {accts.items.map((a: any) => (
            <div key={a.id} className="rounded-2xl bg-primary text-on-primary p-5 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-on-primary/5" aria-hidden />
              <div className="flex justify-between items-start">
                <div><p className="text-on-primary/70 text-xs">{a.accountType}{a.last4 && ` · •••• ${a.last4}`}</p><p className="font-semibold mt-0.5">{a.bankName}</p></div>
                {a.provider === 'SANDBOX' ? <Badge tone="sand">Datos simulados</Badge> : <Badge tone="muted">Manual</Badge>}
              </div>
              <p className="text-2xl font-semibold mt-5 tabular-nums">{money(a.balance)}</p>
              <p className="text-[11px] text-on-primary/70 mt-1">{a.unmatched} sin conciliar · {a.lastSyncedAt ? `actualizado ${date(a.lastSyncedAt, true)}` : 'sin movimientos'}</p>
              {can('banks:write') && (
                <div className="flex gap-2 mt-4">
                  {a.provider === 'SANDBOX'
                    ? <button className="btn btn-sm bg-on-primary/10 hover:bg-on-primary/20 text-on-primary" onClick={() => sync(a.id)} disabled={syncing === a.id}>{syncing === a.id ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Sincronizar</button>
                    : <button className="btn btn-sm bg-on-primary/10 hover:bg-on-primary/20 text-on-primary" onClick={() => setManualFor(a.id)}><Plus className="h-3.5 w-3.5" /> Movimiento</button>}
                  <button className="btn btn-sm bg-on-primary/10 hover:bg-on-primary/20 text-on-primary" onClick={() => setImportFor(a.id)}><FileUp className="h-3.5 w-3.5" /> Importar CSV</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sugg && sugg.length > 0 && (
        <Card title={`Conciliación sugerida (${sugg.length})`} className="mb-5" padded={false}>
          <ul className="divide-y divide-line">
            {sugg.map((s) => (
              <li key={s.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.question}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    Movimiento: {s.bankTransaction.description} · {money(s.bankTransaction.amount)} · {date(s.bankTransaction.date)}
                    {s.sale && <> → Venta #{s.sale.number} por {money(s.sale.total)} ({METHODS[s.sale.paymentMethod]}, {date(s.sale.date)})</>}
                    {s.expense && <> → Gasto {money(s.expense.amount)} ({date(s.expense.date)})</>}
                  </p>
                </div>
                <Badge tone={s.score >= 85 ? 'ok' : 'warn'}>{s.score}% coincidencia</Badge>
                {can('banks:write') && <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => decide(s.id, true)}><Check className="h-3.5 w-3.5" /> Asociar</button>
                  <button className="btn-secondary btn-sm" onClick={() => decide(s.id, false)}><X className="h-3.5 w-3.5" /> No</button>
                </div>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Movimientos" padded={false} actions={<Tabs value={status} onChange={setStatus} items={[{ value: '', label: 'Todos' }, { value: 'UNMATCHED', label: 'Sin identificar' }, { value: 'MATCHED', label: 'Conciliados' }, { value: 'IGNORED', label: 'Ignorados' }]} />}>
        {!txs ? <Loading /> : txs.length === 0 ? <Empty title="Sin movimientos" /> : (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Cuenta</th><th>Estado</th><th className="text-right">Valor</th>{can('banks:write') && <th />}</tr></thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td className="text-ink-muted whitespace-nowrap">{date(t.date)}</td>
                    <td>{t.description}{t.isSimulated && <span className="ml-2"><Badge tone="sand">simulado</Badge></span>}{t.reference && <span className="block text-[11px] text-ink-muted">Ref. {t.reference}</span>}</td>
                    <td className="text-ink-muted">{t.bankName}</td>
                    <td>{t.status === 'MATCHED' ? <Badge tone="ok">Conciliado</Badge> : t.status === 'IGNORED' ? <Badge>Ignorado</Badge> : <Badge tone="warn">Sin identificar</Badge>}</td>
                    <td className={`text-right tabular-nums font-medium ${t.type === 'CREDIT' ? 'text-ok' : 'text-bad'}`}>{t.type === 'CREDIT' ? '+' : '−'}{money(t.amount)}</td>
                    {can('banks:write') && <td className="text-right">{t.status === 'UNMATCHED' && <button className="btn-ghost btn-sm" onClick={() => ignore(t.id)}>Ignorar</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {newAcct && <NewAccount providers={providers ?? []} onClose={() => setNewAcct(false)} onSaved={() => { setNewAcct(false); reloadAll(); }} />}
      {importFor && <ImportCsv accountId={importFor} onClose={() => setImportFor(null)} onDone={() => { setImportFor(null); reloadAll(); }} />}
      {manualFor && <ManualTx accountId={manualFor} onClose={() => setManualFor(null)} onDone={() => { setManualFor(null); reloadAll(); }} />}
    </>
  );
}

function NewAccount({ providers, onClose, onSaved }: { providers: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ bankName: '', accountType: 'AHORROS', accountNumber: '', provider: 'MANUAL', balance: '' });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try { await api('/bank-accounts', { body: { ...f, accountNumber: f.accountNumber || undefined, balance: f.balance || '0' } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title="Agregar cuenta" footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!f.bankName}>Guardar</button></>}>
      <div className="space-y-4">
        {err && <ErrorBox message={err} />}
        <div className="space-y-2">
          <span className="label">Tipo de conexión</span>
          {providers.map((p) => (
            <label key={p.code} className={`flex gap-3 rounded-xl border p-3 ${p.status !== 'available' ? 'opacity-60' : 'cursor-pointer'} ${f.provider === p.code ? 'border-primary bg-sand-50' : 'border-line'}`}>
              <input type="radio" className="accent-primary mt-1" disabled={p.status !== 'available'} checked={f.provider === p.code} onChange={() => setF({ ...f, provider: p.code, bankName: p.code === 'SANDBOX' ? 'Banco de pruebas' : f.bankName })} />
              <span><span className="text-sm font-medium flex items-center gap-2">{p.name}{p.status !== 'available' && <Badge>Requiere contrato</Badge>}</span><span className="block text-xs text-ink-muted mt-0.5">{p.description}</span></span>
            </label>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Banco o billetera"><input className="input" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} placeholder="Bancolombia, Nequi…" /></Field>
          <Field label="Tipo"><select className="input" value={f.accountType} onChange={(e) => setF({ ...f, accountType: e.target.value })}><option value="AHORROS">Ahorros</option><option value="CORRIENTE">Corriente</option><option value="BILLETERA">Billetera digital</option></select></Field>
          <Field label="Número de cuenta (opcional)" hint="Se guarda cifrado; solo se muestran los últimos 4 dígitos"><input className="input" inputMode="numeric" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Saldo actual"><input className="input" inputMode="numeric" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function ImportCsv({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api('/bank-transactions/import', { body: { bankAccountId: accountId, csv } });
      toast(`${r.inserted} importado(s), ${r.skipped} duplicado(s)${r.errors.length ? `, ${r.errors.length} con error` : ''}`); onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Importar extracto (CSV)" wide footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={run} disabled={!csv || busy}>{busy && <Spinner />} Importar</button></>}>
      <div className="space-y-3">
        {err && <ErrorBox message={err} />}
        <p className="text-sm text-ink-muted">Descarga el extracto desde tu banca en línea en formato CSV. Debe tener columnas <b>fecha</b>, <b>descripcion</b> y <b>valor</b> (negativo para egresos); opcional <b>referencia</b>. Los duplicados se omiten automáticamente.</p>
        <input type="file" accept=".csv,text/csv" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        <textarea className="input font-mono text-xs" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'fecha;descripcion;valor;referencia\n05/10/2026;Transferencia recibida;150.000;8842\n06/10/2026;Pago arriendo;-1.800.000;'} />
      </div>
    </Modal>
  );
}

function ManualTx({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ date: todayISO(), amount: '', type: 'CREDIT', description: '', reference: '' });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    try { await api('/bank-transactions', { body: { ...f, bankAccountId: accountId, amount: String(f.amount), date: new Date(f.date + 'T12:00:00').toISOString(), reference: f.reference || undefined } }); onDone(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title="Registrar movimiento" footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={!f.amount || !f.description}>Guardar</button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
        <Field label="Tipo"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="CREDIT">Ingreso (abono)</option><option value="DEBIT">Egreso (cargo)</option></select></Field>
        <Field label="Valor"><input className="input" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
        <Field label="Descripción" className="sm:col-span-2"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Fecha"><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Referencia"><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
