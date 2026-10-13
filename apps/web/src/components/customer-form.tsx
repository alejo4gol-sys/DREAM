'use client';
import { useState } from 'react';
import { ErrorBox, Field, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { CHANNELS } from '@/lib/format';
import { SocialFields } from './social';

export function CustomerForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: (c: any) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', email: '', city: '', taxId: '', channel: '', notes: '', ...Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, v ?? ''])) });
  const [social, setSocial] = useState<Record<string, string>>(initial?.socialLinks ?? {});
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const body: any = Object.fromEntries(['name', 'phone', 'email', 'city', 'taxId', 'channel', 'notes'].map((k) => [k, (f as any)[k] || undefined]));
    body.socialLinks = social;
    try {
      const c = await api(initial?.id ? `/customers/${initial.id}` : '/customers', { method: initial?.id ? 'PATCH' : 'POST', body });
      toast(initial?.id ? 'Cliente actualizado' : 'Cliente creado'); onSaved(c);
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal open onClose={onClose} title={initial?.id ? 'Editar cliente' : 'Nuevo cliente'} footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save} disabled={(f as any).name.length < 2}>Guardar</button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        {error && <div className="sm:col-span-2"><ErrorBox message={error} /></div>}
        <Field label="Nombre *" className="sm:col-span-2"><input className="input" value={(f as any).name} onChange={set('name')} autoFocus /></Field>
        <Field label="Teléfono"><input className="input" value={(f as any).phone} onChange={set('phone')} /></Field>
        <Field label="Correo"><input className="input" type="email" value={(f as any).email} onChange={set('email')} /></Field>
        <Field label="Ciudad"><input className="input" value={(f as any).city} onChange={set('city')} /></Field>
        <Field label="Documento / NIT"><input className="input" value={(f as any).taxId} onChange={set('taxId')} /></Field>
        <Field label="¿Por dónde llegó?" className="sm:col-span-2"><select className="input" value={(f as any).channel} onChange={set('channel')}><option value="">Sin especificar</option>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <div className="sm:col-span-2 pt-1">
          <p className="text-sm font-medium mb-2">Redes sociales del cliente</p>
          <SocialFields value={social} onChange={(v) => setSocial(v as Record<string, string>)} />
        </div>
        <Field label="Observaciones" className="sm:col-span-2"><textarea className="input" rows={2} value={(f as any).notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}
