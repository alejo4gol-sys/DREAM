'use client';
import { ArrowLeft, Ban, Download, FileUp, Mail, MessageCircle, Paperclip, Printer, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { DOC_LABEL, DianBadge, InvoicePreview, invoiceTitle } from '@/components/invoices';
import { waLink } from '@/components/services-ui';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export default function InvoiceDetail({ params }: { params: { id: string } }) {
  const { can, current } = useAuth();
  const toast = useToast();
  const { data: inv, error, reload, setData } = useApi<any>(`/invoices/${params.id}`);
  const { data: settings } = useApi<any>('/invoicing/settings');
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [cufe, setCufe] = useState('');
  const [validatedAt, setValidatedAt] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!inv) return <Loading />;
  const title = invoiceTitle(inv);
  const pdfName = `${inv.kind === 'CREDIT_NOTE' ? 'nota-credito' : 'factura'}-${inv.fullNumber}.pdf`;
  const getPdf = async () => { setBusy('pdf'); try { await download(`/invoices/${inv.id}/pdf`, pdfName); } catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); } };
  const msg = `Hola ${inv.buyer.finalConsumer ? '' : inv.buyer.name.split(' ')[0]}, te compartimos tu ${title.toLowerCase()} No. ${inv.fullNumber} de ${current?.tradeName} por ${money(inv.total)}.` +
    `${inv.warrantyUntil ? ` Tu garantía está vigente hasta el ${date(inv.warrantyUntil)}; conserva este documento.` : ''} Te la enviamos en PDF.`;
  const creditNote = async () => {
    setBusy('void');
    try { const nc = await api<any>(`/invoices/${inv.id}/credit-note`, { body: { reason } }); toast(`Nota crédito ${nc.fullNumber} expedida`); setVoidOpen(false); setData(await api(`/invoices/${inv.id}`)); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const sendDian = async () => {
    setBusy('send');
    try { const r = await api<any>(`/invoices/${inv.id}/send`, { body: {} }); setData({ ...inv, ...r }); toast(['ACCEPTED', 'SIMULATED'].includes(r.dianStatus) ? 'Factura validada' : 'Revisa el mensaje de la DIAN'); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const registerDian = async () => {
    setBusy('dian');
    try { setData(await api(`/invoices/${inv.id}/dian`, { body: { cufe: cufe.trim(), validatedAt: validatedAt || undefined } })); toast('Validación DIAN registrada'); setCufe(''); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy('file');
    try { const form = new FormData(); form.append('file', file); setData(await api(`/invoices/${inv.id}/files`, { form })); toast('Archivo guardado'); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };
  const daysLeft = inv.warrantyUntil ? Math.ceil((new Date(inv.warrantyUntil).getTime() - Date.now()) / 86400000) : null;

  return <>
    <div className="no-print">
      <Link href="/facturas" className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" /> Facturas</Link>
      <PageHeader title={`${title} ${inv.fullNumber}`} subtitle={<span className="flex flex-wrap items-center gap-2">{date(inv.issuedAt, true)} · {inv.status === 'VOIDED' ? <Badge tone="bad">Anulada</Badge> : <Badge tone="ok">Vigente</Badge>}{inv.docType === 'ELECTRONIC' && <DianBadge status={inv.dianStatus} />}</span>}
        actions={<>
          <button className="btn-primary" onClick={getPdf} disabled={busy === 'pdf'}>{busy === 'pdf' ? <Spinner /> : <Download className="h-4 w-4" />} Descargar PDF</button>
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</button>
          <a className="btn-secondary" href={waLink(inv.buyer.phone, msg)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          {inv.buyer.email && <a className="btn-secondary" href={`mailto:${inv.buyer.email}?subject=${encodeURIComponent(`${title} ${inv.fullNumber} - ${current?.tradeName ?? ''}`)}&body=${encodeURIComponent(msg)}`}><Mail className="h-4 w-4" /> Correo</a>}
          {inv.kind === 'INVOICE' && inv.status === 'ISSUED' && can('sales:cancel') && <button className="btn-danger" onClick={() => setVoidOpen(true)}><Ban className="h-4 w-4" /> Anular con nota crédito</button>}
        </>} />
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <Card padded={false} className="print-area overflow-hidden"><InvoicePreview inv={inv} /></Card>
      <div className="space-y-4 no-print">
        {inv.kind === 'INVOICE' && <Card>
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Garantía</h3>
          {inv.warrantyUntil ? <p className="text-sm mt-1">{inv.warrantyActive ? <>Vigente hasta el <b>{date(inv.warrantyUntil)}</b> ({daysLeft} días).</> : <>Venció el {date(inv.warrantyUntil)}.</>}</p>
            : <p className="text-sm text-ink-muted mt-1">Sin término indicado. Por ley (Ley 1480 de 2011) es de un año para productos nuevos y tres meses para usados o reparaciones.</p>}
          {inv.warrantyText && <p className="text-xs text-ink-muted mt-1">{inv.warrantyText}</p>}
          {inv.sale && <Link href={`/ventas/${inv.sale.id}`} className="btn-secondary w-full mt-3">Ver venta #{inv.sale.number}</Link>}
          {inv.sale && <Link href={`/devoluciones?venta=${inv.sale.id}`} className="btn-ghost w-full mt-1 text-xs">Registrar devolución o cambio</Link>}
        </Card>}

        {inv.docType === 'ELECTRONIC' && <Card>
          <h3 className="font-semibold">DIAN</h3>
          <div className="mt-1"><DianBadge status={inv.dianStatus} /></div>
          {inv.dianMessage && <p className="text-xs text-ink-muted mt-2">{inv.dianMessage}</p>}
          {inv.cufe && <p className="text-[11px] font-mono break-all mt-2">{inv.kind === 'CREDIT_NOTE' ? 'CUDE' : 'CUFE'}: {inv.cufe}</p>}
          {inv.dianValidatedAt && <p className="text-xs mt-1">Validada el {date(inv.dianValidatedAt, true)}</p>}
          {inv.dianData?.number && <p className="text-xs mt-1">Número en la DIAN: <b>{inv.dianData.number}</b></p>}
          {(inv.dianData?.publicUrl || inv.dianData?.qr) && <div className="flex flex-wrap gap-3 mt-1">
            {inv.dianData.publicUrl && <a className="text-xs underline" href={inv.dianData.publicUrl} target="_blank" rel="noreferrer">Ver factura en Factus</a>}
            {inv.dianData.qr && <a className="text-xs underline" href={inv.dianData.qr} target="_blank" rel="noreferrer">Código QR DIAN</a>}</div>}
          {inv.kind === 'INVOICE' && inv.status === 'ISSUED' && ['PENDING', 'REJECTED'].includes(inv.dianStatus) && settings?.einvoiceMode === 'PROVIDER' && can('sales:create') &&
            <button className="btn-primary w-full mt-3" disabled={busy === 'send'} onClick={sendDian}>{busy === 'send' && <Spinner />} {inv.dianStatus === 'REJECTED' ? 'Reenviar a la DIAN' : 'Enviar a la DIAN'}</button>}
          {inv.dianStatus === 'ACCEPTED' && inv.cufe && <a className="text-xs underline mt-1 inline-block" target="_blank" rel="noreferrer" href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${inv.cufe}`}>Consultar en la DIAN</a>}
          {['PENDING', 'REJECTED'].includes(inv.dianStatus) && can('sales:create') && <div className="mt-3 space-y-2 border-t border-line pt-3">
            <p className="text-xs">¿Ya la expediste en el portal de la DIAN o con tu proveedor? Registra el código que te entregaron:</p>
            <Field label={inv.kind === 'CREDIT_NOTE' ? 'CUDE (96 caracteres)' : 'CUFE (96 caracteres)'}><input className="input font-mono text-xs" value={cufe} onChange={(e) => setCufe(e.target.value.replace(/[^a-fA-F0-9]/g, '').slice(0, 96))} /></Field>
            <Field label="Fecha de validación"><input className="input" type="date" value={validatedAt} onChange={(e) => setValidatedAt(e.target.value)} /></Field>
            <button className="btn-primary w-full" disabled={cufe.length !== 96 || busy === 'dian'} onClick={registerDian}>{busy === 'dian' && <Spinner />} Registrar validación</button>
          </div>}
        </Card>}

        <Card>
          <h3 className="font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Archivos guardados</h3>
          <p className="text-xs text-ink-muted mt-1">Guarda aquí el XML y el PDF que entrega la DIAN o tu proveedor. Se conservan con la factura.</p>
          <ul className="mt-2 space-y-1">{inv.files.map((f: any) => <li key={f.id}><button className="text-sm underline text-left break-all" onClick={() => download(`/invoices/${inv.id}/files/${f.id}`, f.filename).catch((e) => toast(e.message, 'bad'))}>{f.kind} · {f.filename}</button> <span className="text-[11px] text-ink-muted">{Math.ceil(f.size / 1024)} KB</span></li>)}</ul>
          {can('sales:create') && <>
            <input ref={fileRef} type="file" accept=".pdf,.xml,.zip,application/pdf,application/xml,text/xml,application/zip" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button className="btn-secondary w-full mt-3" disabled={busy === 'file'} onClick={() => fileRef.current?.click()}>{busy === 'file' ? <Spinner /> : <FileUp className="h-4 w-4" />} Adjuntar PDF, XML o ZIP</button>
          </>}
        </Card>

        <Card>
          <h3 className="font-semibold">Detalles</h3>
          <dl className="text-xs space-y-1 mt-2">
            <div className="flex justify-between gap-2"><dt className="text-ink-muted">Documento</dt><dd>{inv.kind === 'CREDIT_NOTE' ? 'Nota crédito' : DOC_LABEL[inv.docType]}</dd></div>
            {inv.related && <div className="flex justify-between gap-2"><dt className="text-ink-muted">{inv.kind === 'CREDIT_NOTE' ? 'Afecta' : 'Anulada con'}</dt><dd><Link className="underline" href={`/facturas/${inv.related.id}`}>{inv.related.fullNumber}</Link></dd></div>}
            {inv.voidReason && <div><dt className="text-ink-muted">Motivo</dt><dd>{inv.voidReason}</dd></div>}
            <div className="flex justify-between gap-2"><dt className="text-ink-muted">Código de integridad</dt><dd className="font-mono">{inv.integrityHash.slice(0, 16)}</dd></div>
          </dl>
          <p className="text-[11px] text-ink-muted mt-2">Las facturas no se pueden editar ni borrar: así queda la prueba de lo vendido. Para corregir, se anula con nota crédito y se expide una nueva.</p>
        </Card>
      </div>
    </div>

    <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title={`Anular ${inv.fullNumber}`}
      footer={<><button className="btn-ghost" onClick={() => setVoidOpen(false)}>Cancelar</button><button className="btn-danger" disabled={reason.trim().length < 5 || busy === 'void'} onClick={creditNote}>{busy === 'void' && <Spinner />} Expedir nota crédito</button></>}>
      <div className="space-y-3 text-sm">
        <p>Se expedirá una nota crédito por el valor total y la factura quedará anulada (no se borra). {inv.docType === 'ELECTRONIC' && 'Si es electrónica, la nota crédito también debe validarse ante la DIAN.'}</p>
        <p className="text-xs text-ink-muted">Esto no anula la venta ni devuelve el inventario: si el cliente devolvió el producto, regístralo en Devoluciones.</p>
        <Field label="Motivo"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ej.: error en los datos del cliente" /></Field>
      </div>
    </Modal>
  </>;
}
