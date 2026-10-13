'use client';
import { Check, CheckCircle2, ChevronRight, Copy, Gift, Link2, MessageCircle, QrCode, Rocket, Share2, Star, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, Card, ErrorBox, Field, Loading, Modal, Spinner, cn, useToast } from './ui';

const waLink = (text: string, phone?: string | null) => {
  const p = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${p ? (p.length === 10 ? `57${p}` : p) : ''}?text=${encodeURIComponent(text)}`;
};

/** Guía de arranque en el tablero: pasos para dejar el negocio listo para vender. */
export function OnboardingCard() {
  const { data, reload } = useApi<any>('/growth/onboarding');
  const [busy, setBusy] = useState(false);
  if (!data || data.dismissed) return null;
  if (data.percent === 100) return data.testimonialGiven ? null : <TestimonialPrompt />;
  const hide = async () => { setBusy(true); try { await api('/growth/onboarding/dismiss', { method: 'POST' }); reload(); } finally { setBusy(false); } };
  return <section className="card p-5 mb-5 border-sand-200 bg-gradient-to-br from-sand-50 to-white">
    <div className="flex items-start gap-3">
      <span className="h-10 w-10 rounded-xl bg-ink text-on-primary flex items-center justify-center shrink-0"><Rocket className="h-5 w-5" /></span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Deja tu negocio listo para vender</h2>
          <button className="btn-ghost h-8 px-2 text-xs" onClick={hide} disabled={busy} title="Ocultar la guía"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-ink-muted">{data.done} de {data.total} pasos · {data.percent} %</p>
        <div className="h-2 rounded-full bg-sand-100 mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-[#C8963E] via-[#D9774B] to-[#C4513F] transition-all" style={{ width: `${data.percent}%` }} /></div>
      </div>
    </div>
    <ol className="mt-4 grid sm:grid-cols-2 gap-2">
      {data.steps.map((s: any, i: number) => <li key={s.key}>
        <Link href={s.href} className={cn('flex items-start gap-3 rounded-xl border px-3 py-2.5 transition', s.done ? 'border-line bg-white/60 opacity-70' : 'border-sand-200 bg-white hover:border-ink/30')}>
          <span className={cn('mt-0.5 h-6 w-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0', s.done ? 'bg-ok text-white' : 'bg-sand-100 text-ink')}>{s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
          <span className="flex-1 min-w-0"><span className={cn('block text-sm font-medium', s.done && 'line-through')}>{s.title}</span><span className="block text-xs text-ink-muted">{s.text}</span></span>
          {!s.done && <ChevronRight className="h-4 w-4 text-ink-muted mt-1" />}
        </Link>
      </li>)}
    </ol>
  </section>;
}

function TestimonialPrompt() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return <section className="card p-4 mb-5 flex flex-wrap items-center gap-3">
    <Star className="h-5 w-5 text-sand-600" />
    <p className="text-sm flex-1 min-w-[200px]"><b>¡Tu negocio ya está listo!</b> ¿Nos cuentas cómo te ha ido con DREAMS? Tu opinión ayuda a otros emprendedores.</p>
    <button className="btn-secondary" onClick={() => setOpen(true)}>Dejar mi opinión</button>
    <button className="btn-ghost h-9 px-2" onClick={() => setHidden(true)} aria-label="Cerrar"><X className="h-4 w-4" /></button>
    <TestimonialModal open={open} onClose={() => setOpen(false)} onDone={() => setHidden(true)} />
  </section>;
}

export function TestimonialModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ rating: 5, body: '', authorName: '', city: '', consent: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try { await api('/growth/testimonials', { body: { ...f, city: f.city || undefined } }); toast('¡Gracias! Revisaremos tu opinión antes de publicarla.'); onClose(); onDone?.(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal open={open} onClose={onClose} title="Tu opinión sobre DREAMS"
    footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={busy || f.body.length < 20 || f.authorName.length < 2 || !f.consent} onClick={send}>{busy && <Spinner />} Enviar</button></>}>
    <div className="space-y-3">
      {err && <ErrorBox message={err} />}
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setF({ ...f, rating: n })} aria-label={`${n} estrellas`}><Star className={cn('h-7 w-7', n <= f.rating ? 'fill-[#D9A441] text-[#D9A441]' : 'text-line')} /></button>)}</div>
      <Field label="¿Cómo te ha ayudado DREAMS?" hint={`${f.body.length}/600 · mínimo 20 caracteres`}><textarea className="input min-h-[100px]" maxLength={600} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tu nombre (como quieres que aparezca)"><input className="input" value={f.authorName} onChange={(e) => setF({ ...f, authorName: e.target.value })} /></Field>
        <Field label="Ciudad (opcional)"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
      </div>
      <label className="flex gap-2 items-start text-xs text-ink-muted"><input type="checkbox" className="mt-0.5 accent-ink" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
        <span>Autorizo a DREAMS a publicar esta opinión con mi nombre, el nombre de mi negocio y mi ciudad en su página web. Puedo pedir que la retiren en cualquier momento.</span></label>
    </div>
  </Modal>;
}

/** «Invita y gana»: código y enlace de referidos con los días ganados. */
export function ReferralsPanel() {
  const toast = useToast();
  const { data, error, loading } = useApi<any>('/growth/referrals');
  const [open, setOpen] = useState(false);
  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Loading />;
  const text = `¡Hola! Yo manejo mi negocio con DREAMS: ventas, inventario, cobros y mi página web en un solo lugar. Regístrate gratis con mi enlace: ${data.link}`;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { toast('No se pudo copiar', 'bad'); } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'DREAMS', text, url: data.link }); } catch { /* cancelado */ } } else copy(text); };
  return <div className="grid lg:grid-cols-3 gap-5">
    <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><Gift className="h-5 w-5 text-sand-600" /> Invita y gana</span>}>
      <p className="text-sm text-ink-muted">Por cada negocio que se registre con tu enlace <b className="text-ink">y pague un plan</b>, ganas <b className="text-ink">{data.days} días</b>: si estás en el plan Gratis te activamos {data.days} días del plan Emprendedor; si ya pagas, te sumamos {data.days} días a tu plan. Sin límite de invitados.</p>
      <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-2">
        <div className="input flex items-center gap-2 font-mono text-sm truncate"><Link2 className="h-4 w-4 text-ink-muted shrink-0" /><span className="truncate">{data.link}</span></div>
        <button className="btn-secondary" onClick={() => copy(data.link)}><Copy className="h-4 w-4" /> Copiar enlace</button>
      </div>
      <p className="text-sm mt-3">Tu código: <span className="font-mono font-semibold tracking-wider bg-sand-50 border border-sand-200 rounded-lg px-2 py-1">{data.code}</span></p>
      <div className="flex flex-wrap gap-2 mt-4">
        <a className="btn-primary" href={waLink(text)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Enviar por WhatsApp</a>
        <button className="btn-secondary" onClick={share}><Share2 className="h-4 w-4" /> Compartir</button>
        <button className="btn-secondary" onClick={() => setOpen(true)}><QrCode className="h-4 w-4" /> Ver mensaje</button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Mensaje para invitar" footer={<button className="btn-primary" onClick={() => copy(text)}><Copy className="h-4 w-4" /> Copiar</button>}>
        <p className="text-sm whitespace-pre-wrap bg-sand-50 rounded-xl p-3">{text}</p>
      </Modal>
    </Card>
    <Card title="Tus resultados">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-sand-50 p-3"><p className="text-2xl font-semibold">{data.invited.length}</p><p className="text-xs text-ink-muted">Negocios invitados</p></div>
        <div className="rounded-xl bg-sand-50 p-3"><p className="text-2xl font-semibold">{data.totalDays}</p><p className="text-xs text-ink-muted">Días ganados</p></div>
      </div>
      {data.subscription?.currentPeriodEnd && <p className="text-xs text-ink-muted mt-3">Tu plan {data.subscription.status === 'TRIALING' ? 'de regalo' : ''} va hasta el {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
      <ul className="mt-3 divide-y divide-line text-sm">
        {data.invited.length === 0 && <li className="py-2 text-ink-muted">Aún no tienes invitados.</li>}
        {data.invited.map((i: any, k: number) => <li key={k} className="py-2 flex items-center justify-between gap-2"><span className="truncate">{i.name}</span>
          {i.rewarded ? <Badge tone="ok"><CheckCircle2 className="h-3 w-3" /> +{data.days} días</Badge> : <Badge tone="muted">Aún en plan Gratis</Badge>}</li>)}
      </ul>
    </Card>
  </div>;
}

/** Cobrar el saldo de una venta: link de pago (Wompi), medios propios (Nequi, Daviplata, Bre-B…) y mensaje para WhatsApp. */
export function CollectModal({ saleId, open, onClose }: { saleId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any>(open ? `/collect/sales/${saleId}` : null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const makeLink = async () => {
    setBusy(true); setErr(null);
    try { await api('/collect/links', { body: { saleId, amount: amount || undefined } }); reload(); toast('Link de pago creado'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const showQr = async (id: string) => {
    try { const r = await api<Response>(`/collect/links/${id}/qr`, { raw: true }); setQr(URL.createObjectURL(await r.blob())); } catch (e) { setErr((e as Error).message); }
  };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { /* */ } };
  const lastLink = data?.links?.find((l: any) => l.status === 'PENDING');
  const message = data ? data.message + (lastLink ? `\n\nPaga en línea aquí: ${lastLink.url}` : '') : '';
  return <Modal open={open} onClose={onClose} title="Cobrar" wide>
    {error ? <ErrorBox message={error} /> : loading || !data ? <Loading /> : <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-2xl font-semibold">{money(data.sale.balance)}</p>
        <p className="text-sm text-ink-muted">por cobrar de la venta #{data.sale.number}{data.customer ? ` · ${data.customer.name}` : ''}</p>
      </div>
      {err && <ErrorBox message={err} />}
      <section className="rounded-xl border border-line p-4">
        <h3 className="font-medium flex items-center gap-2"><Wallet className="h-4 w-4" /> Link de pago (tarjeta, PSE, Nequi, Bancolombia)</h3>
        {data.wompiEnabled ? <>
          <p className="text-xs text-ink-muted mt-1">Cuando el cliente pague, el abono queda registrado solo en esta venta.{data.wompiTest && ' Estás en modo de pruebas de Wompi.'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <input className="input w-40" inputMode="numeric" placeholder={`Valor (máx. ${Number(data.sale.balance).toLocaleString('es-CO')})`} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            <button className="btn-primary" onClick={makeLink} disabled={busy}>{busy && <Spinner />} Crear link</button>
          </div>
          {data.links.length > 0 && <ul className="mt-3 divide-y divide-line text-sm">{data.links.map((l: any) => <li key={l.id} className="py-2 flex flex-wrap items-center gap-2">
            <span className="font-medium">{money(l.amount)}</span>
            <Badge tone={l.status === 'PAID' ? 'ok' : 'sand'}>{l.status === 'PAID' ? 'Pagado' : 'Pendiente'}</Badge>
            <span className="flex-1" />
            {l.status !== 'PAID' && <><button className="btn-ghost h-8 px-2" onClick={() => copy(l.url)}><Copy className="h-4 w-4" /> Copiar</button>
              <button className="btn-ghost h-8 px-2" onClick={() => showQr(l.id)}><QrCode className="h-4 w-4" /> QR</button></>}
          </li>)}</ul>}
        </> : <p className="text-sm text-ink-muted mt-1">Para cobrar con link de pago conecta tu cuenta de Wompi en <Link className="underline" href="/mi-tienda">Mi página web → Pagos</Link>.</p>}
      </section>
      {data.methods.length > 0 && <section className="rounded-xl border border-line p-4">
        <h3 className="font-medium">Tus medios de pago</h3>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">{data.methods.map((m: any, i: number) => <div key={i} className="rounded-lg bg-sand-50 p-3 text-sm">
          <p className="font-medium">{m.name}</p>
          <p className="text-ink-muted">{[m.bank, m.type, m.number].filter(Boolean).join(' · ')}{m.holder ? ` · ${m.holder}` : ''}</p>
          {m.qrImage && <img src={m.qrImage} alt={`QR ${m.name}`} className="mt-2 h-32 w-32 object-contain bg-white rounded-lg" />}
          {m.link && <a className="text-xs underline break-all" href={m.link} target="_blank" rel="noreferrer">{m.link}</a>}
        </div>)}</div>
        <p className="text-xs text-ink-muted mt-2">Las llaves y códigos QR de Bre-B, Nequi o Daviplata son los de tu banco o billetera: súbelos en Mi página web → Pagos.</p>
      </section>}
      <section className="rounded-xl border border-line p-4">
        <h3 className="font-medium flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Mensaje de cobro</h3>
        <p className="text-sm whitespace-pre-wrap bg-sand-50 rounded-xl p-3 mt-2 max-h-48 overflow-auto">{message}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <a className="btn-primary" href={waLink(message, data.customer?.phone)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Enviar por WhatsApp</a>
          <button className="btn-secondary" onClick={() => copy(message)}><Copy className="h-4 w-4" /> Copiar</button>
        </div>
      </section>
      <Modal open={!!qr} onClose={() => setQr(null)} title="QR del link de pago">{qr && <img src={qr} alt="QR" className="mx-auto h-72 w-72" />}</Modal>
    </div>}
  </Modal>;
}
