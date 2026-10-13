'use client';
import { CheckCircle2, ExternalLink, PlugZap, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge, Card, ErrorBox, Field, Loading, Spinner, cn, useToast } from './ui';

/** Conexión con el proveedor tecnológico Factus para enviar las facturas electrónicas a la DIAN. */
export function ProviderCard({ onChanged }: { onChanged?: () => void }) {
  const toast = useToast();
  const { data, error, reload } = useApi<any>('/invoicing/provider');
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [test, setTest] = useState<any>(null);
  useEffect(() => { if (data) { setF({ env: data.env, clientId: data.clientId, clientSecret: '', username: data.username, password: '', numberingRangeId: data.numberingRangeId ?? '', priceIncludesTax: data.priceIncludesTax, autoSend: data.autoSend }); setTest(data.lastTest); } }, [data]);
  if (error) return <ErrorBox message={error} />;
  if (!data || !f) return <Card><Loading /></Card>;
  const save = async () => {
    setBusy('save');
    try {
      await api('/invoicing/provider', { method: 'PUT', body: { provider: 'FACTUS', env: f.env, clientId: f.clientId, username: f.username, clientSecret: f.clientSecret || undefined, password: f.password || undefined,
        numberingRangeId: f.numberingRangeId ? Number(f.numberingRangeId) : null, priceIncludesTax: f.priceIncludesTax, autoSend: f.autoSend } });
      toast('Proveedor guardado'); reload(); onChanged?.();
    } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const runTest = async () => { setBusy('test'); try { setTest(await api('/invoicing/provider/test', { body: {} })); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); } };
  const disconnect = async () => { if (!confirm('¿Desconectar Factus? Las facturas electrónicas no se enviarán automáticamente.')) return; await api('/invoicing/provider', { method: 'PUT', body: { provider: 'NONE' } }); reload(); onChanged?.(); };
  return <Card title={<span className="flex items-center gap-2"><PlugZap className="h-4 w-4" /> Proveedor tecnológico: Factus</span>}
    actions={data.configured ? <Badge tone={f.env === 'production' ? 'ok' : 'warn'}>{f.env === 'production' ? 'Producción' : 'Pruebas'}</Badge> : <Badge tone="muted">Sin conectar</Badge>}>
    <p className="text-sm text-ink-muted">Con Factus (Halltec), cada factura electrónica que expidas en DREAMS se envía sola a la DIAN y recibes el CUFE, el QR y el enlace público. Necesitas tu propio contrato con Factus: ellos te entregan estas credenciales.</p>
    <div className="grid sm:grid-cols-2 gap-3 mt-4">
      <Field label="Ambiente"><div className="flex gap-2">{[['sandbox', 'Pruebas'], ['production', 'Producción']].map(([v, l]) => <button key={v} type="button" onClick={() => setF({ ...f, env: v })} className={cn('flex-1 h-10 rounded-xl border text-sm', f.env === v ? 'border-ink bg-ink text-white' : 'border-line')}>{l}</button>)}</div></Field>
      <Field label="ID del rango de numeración (Factus)" hint="Lo ves al probar la conexión"><input className="input" inputMode="numeric" value={f.numberingRangeId} onChange={(e) => setF({ ...f, numberingRangeId: e.target.value.replace(/\D/g, '') })} /></Field>
      <Field label="Client ID"><input className="input font-mono text-xs" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} /></Field>
      <Field label="Client secret" hint={data.hasSecret ? 'Guardado. Escríbelo solo si quieres cambiarlo.' : undefined}><input className="input font-mono text-xs" type="password" autoComplete="off" value={f.clientSecret} onChange={(e) => setF({ ...f, clientSecret: e.target.value })} /></Field>
      <Field label="Usuario (correo en Factus)"><input className="input" autoComplete="off" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
      <Field label="Contraseña de Factus" hint={data.hasPassword ? 'Guardada. Escríbela solo si quieres cambiarla.' : undefined}><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
    </div>
    <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" className="accent-ink" checked={f.autoSend} onChange={(e) => setF({ ...f, autoSend: e.target.checked })} /> Enviar a la DIAN apenas expida la factura</label>
    <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" className="accent-ink" checked={f.priceIncludesTax} onChange={(e) => setF({ ...f, priceIncludesTax: e.target.checked })} /> Enviar los precios con IVA incluido <span className="text-xs text-ink-muted">(actívalo solo si en pruebas el total de Factus no coincide)</span></label>
    <div className="flex flex-wrap gap-2 mt-4">
      <button className="btn-primary" onClick={save} disabled={!!busy || !f.clientId || !f.username}>{busy === 'save' && <Spinner />} Guardar</button>
      {data.configured && <button className="btn-secondary" onClick={runTest} disabled={!!busy}>{busy === 'test' && <Spinner />} Probar conexión</button>}
      {data.configured && <button className="btn-ghost text-bad" onClick={disconnect}>Desconectar</button>}
    </div>
    {test && <div className={cn('mt-3 rounded-xl p-3 text-sm', test.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900')}>
      <p className="flex items-center gap-2">{test.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{test.message}</p>
      {test.ranges?.length > 0 && <ul className="mt-2 text-xs space-y-1">{test.ranges.map((r: any) => <li key={r.id}><b>ID {r.id}</b> · {r.document ?? 'Rango'} · prefijo {r.prefix} · del {r.from} al {r.to}{r.current ? ` · actual ${r.current}` : ''}</li>)}</ul>}
    </div>}
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Pasos para empezar con Factus</summary>
      <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs text-ink-muted">
        <li>Habilítate como facturador electrónico en la DIAN eligiendo a Factus (Halltec) como proveedor tecnológico.</li>
        <li>Pide a Factus tus credenciales de pruebas (client ID, secret, usuario y contraseña) y pégalas aquí en «Pruebas».</li>
        <li>Expide 2 o 3 facturas de prueba en DREAMS y revisa que el total y los datos coincidan.</li>
        <li>Registra en DREAMS la misma resolución y prefijo que tienes en Factus, cambia a «Producción» con las credenciales de producción y prueba la conexión.</li>
      </ol>
      <a className="text-xs underline inline-flex items-center gap-1 mt-2" href="https://developers.factus.com.co" target="_blank" rel="noreferrer">Documentación de Factus <ExternalLink className="h-3 w-3" /></a>
    </details>
    <p className="text-[11px] text-ink-muted mt-3">Las notas crédito electrónicas aún se expiden en Factus y se registra aquí su CUDE. Las credenciales se guardan cifradas y nunca se muestran.</p>
  </Card>;
}
