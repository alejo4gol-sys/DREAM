'use client';
import { SERVICE_PROFILES } from '@/lib/service-profiles';
import { Check, ImagePlus, Monitor, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ReferralsPanel } from '@/components/growth';
import { Badge, Card, ErrorBox, Field, Loading, Modal, PageHeader, Spinner, TableWrap, Tabs, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLES, date, money, number } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { SocialFields, SocialIcons } from '@/components/social';
import { PalettePicker } from '@/components/palette-picker';
import { BrandColors } from '@/lib/theme';

type Tab = 'negocio' | 'usuarios' | 'seguridad' | 'notificaciones' | 'plan' | 'auditoria' | 'invitar';

function Settings() {
  const { can } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => {
    const requested = params.get('tab') as Tab | null;
    return requested && (requested !== 'plan' || can('business:manage')) ? requested : can('business:manage') ? 'negocio' : 'seguridad';
  });
  useEffect(() => { const t = params.get('tab') as Tab; if (t && (t !== 'plan' || can('business:manage'))) setTab(t); }, [params, can]);
  const items = [
    can('business:manage') && { value: 'negocio' as Tab, label: 'Negocio' },
    can('members:manage') && { value: 'usuarios' as Tab, label: 'Usuarios y roles' },
    { value: 'seguridad' as Tab, label: 'Mi cuenta y seguridad' },
    { value: 'notificaciones' as Tab, label: 'Notificaciones' },
    can('business:manage') && { value: 'plan' as Tab, label: 'Plan y pagos' },
    can('business:manage') && { value: 'invitar' as Tab, label: 'Invita y gana' },
    can('audit:read') && { value: 'auditoria' as Tab, label: 'Auditoría' },
  ].filter(Boolean) as { value: Tab; label: string }[];
  return (
    <>
      <PageHeader title="Configuración" actions={<Tabs value={tab} onChange={(t) => { setTab(t); router.replace(`/configuracion?tab=${t}`); }} items={items} />} />
      {tab === 'negocio' && <BusinessTab />}
      {tab === 'usuarios' && <MembersTab />}
      {tab === 'seguridad' && <SecurityTab />}
      {tab === 'notificaciones' && <NotificationsTab />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'invitar' && <ReferralsPanel />}
      {tab === 'auditoria' && <AuditTab />}
    </>
  );
}

export default function Page() { return <Suspense><Settings /></Suspense>; }

function BusinessTab() {
  const toast = useToast();
  const { reload: reloadAuth } = useAuth();
  const { data } = useApi<any>('/businesses/current');
  const [f, setF] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])), monthlyGoal: data.monthlyGoal ? String(Number(data.monthlyGoal)) : '', social: data.socialLinks ?? {} }); }, [data]);
  if (!f) return <Loading />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const upload = async (file: File) => {
    const form = new FormData(); form.append('file', file);
    try { const r = await api<{ url: string }>('/uploads/image', { form }); setF((x: any) => ({ ...x, logoUrl: r.url })); } catch (e) { setErr((e as Error).message); }
  };
  const save = async () => {
    setBusy(true); setErr(null);
    const keys = ['tradeName', 'legalName', 'taxId', 'phone', 'email', 'address', 'city', 'country', 'businessType', 'category', 'logoUrl', 'monthlyGoal', 'businessModel', 'serviceProfile'];
    const body: any = Object.fromEntries(keys.map((k) => [k, f[k] === '' ? undefined : String(f[k])]));
    body.socialLinks = Object.fromEntries(Object.entries(f.social).filter(([, v]) => v));
    try { await api('/businesses/current', { method: 'PATCH', body }); toast('Datos del negocio actualizados'); reloadAuth(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
    <BrandCard data={data} onSaved={reloadAuth} />
    <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
      <Card title="Logo">
        <label className="h-40 rounded-2xl border border-dashed border-sand-400 bg-sand-50 flex flex-col items-center justify-center text-xs text-ink-muted cursor-pointer overflow-hidden">
          {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="h-full w-full object-contain p-4" /> : <><ImagePlus className="h-5 w-5 mb-1 text-sand-500" /> Subir logo</>}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <p className="text-[11px] text-ink-faint mt-2">PNG, JPG o WEBP, máx. 2 MB.</p>
      </Card>
      <Card title="Datos del negocio">
        <div className="grid sm:grid-cols-2 gap-3">
          {err && <div className="sm:col-span-2"><ErrorBox message={err} /></div>}
          <Field label="Nombre comercial"><input className="input" value={f.tradeName} onChange={set('tradeName')} /></Field>
          <Field label="Razón social"><input className="input" value={f.legalName} onChange={set('legalName')} /></Field>
          <Field label="NIT"><input className="input" value={f.taxId} onChange={set('taxId')} /></Field>
          <Field label="Teléfono"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Dirección"><input className="input" value={f.address} onChange={set('address')} /></Field>
          <Field label="Ciudad"><input className="input" value={f.city} onChange={set('city')} /></Field>
          <Field label="País"><select className="input" value={f.country} onChange={set('country')}><option value="CO">Colombia</option><option value="EC">Ecuador</option><option value="PE">Perú</option><option value="MX">México</option><option value="CL">Chile</option></select></Field>
          <Field label="Mi negocio" hint="Cambia el menú y las herramientas de DREAMS."><select className="input" value={f.businessModel || 'PRODUCTS'} onChange={(e) => setF({ ...f, businessModel: e.target.value, serviceProfile: e.target.value === 'SERVICES' ? (f.serviceProfile || 'OTHER') : f.serviceProfile })}><option value="PRODUCTS">Vendo productos</option><option value="SERVICES">Presto servicios</option></select></Field>
          {f.businessModel === 'SERVICES' ? <Field label="Tipo de servicio"><select className="input" value={f.serviceProfile || 'OTHER'} onChange={set('serviceProfile')}>{Object.values(SERVICE_PROFILES).map((sp) => <option key={sp.key} value={sp.key}>{sp.label}</option>)}</select></Field> : <span />}
          <Field label="Tipo de negocio"><input className="input" value={f.businessType} onChange={set('businessType')} /></Field>
          <Field label="Categoría"><input className="input" value={f.category} onChange={set('category')} /></Field>
          <Field label="Meta de ventas mensual" hint="Te avisamos cuando la alcances"><input className="input" inputMode="numeric" value={f.monthlyGoal} onChange={(e) => setF({ ...f, monthlyGoal: e.target.value.replace(/\D/g, '') })} /></Field>
          <span />
          {['instagram', 'facebook', 'whatsapp', 'tiktok'].map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className="input" value={f.social[k] ?? ''} onChange={(e) => setF({ ...f, social: { ...f.social, [k]: e.target.value } })} /></Field>
          ))}
        </div>
        <div className="flex justify-end mt-5"><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Guardar cambios</button></div>
      </Card>
    </div>
    </div>
  );
}

function BrandCard({ data, onSaved }: { data: any; onSaved: () => void }) {
  const toast = useToast();
  const [brand, setBrand] = useState<BrandColors | null>(data?.brandColors ?? null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(brand) !== JSON.stringify(data?.brandColors ?? null);
  const save = async () => {
    if (!brand) return;
    setBusy(true);
    try { await api('/businesses/current', { method: 'PATCH', body: { brandColors: brand } }); toast('Paleta de marca actualizada'); onSaved(); }
    catch (e) { toast((e as Error).message, 'bad'); } finally { setBusy(false); }
  };
  if (!data) return null;
  return (
    <Card title="Colores de tu marca" actions={<button className="btn-primary btn-sm" onClick={save} disabled={!dirty || busy || !brand}>{busy && <Spinner />} Guardar paleta</button>}>
      <PalettePicker value={brand} onChange={setBrand} businessName={data.tradeName} />
    </Card>
  );
}

function MembersTab() {
  const toast = useToast();
  const { data, reload } = useApi<any[]>('/businesses/current/members');
  const { data: rolesRaw } = useApi<any[]>('/businesses/current/roles');
  const ORDER = ['OWNER', 'ADMIN', 'SELLER', 'ACCOUNTANT', 'EMPLOYEE'];
  const roles = rolesRaw?.slice().sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ fullName: '', email: '', roleKey: 'SELLER' });
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    try { await api('/businesses/current/members', { body: f }); toast('Usuario agregado. Le enviamos un correo de acceso.'); setOpen(false); setF({ fullName: '', email: '', roleKey: 'SELLER' }); reload(); }
    catch (e) { setErr((e as Error).message); }
  };
  const change = async (id: string, body: any) => { try { await api(`/businesses/current/members/${id}`, { method: 'PATCH', body }); reload(); toast('Usuario actualizado'); } catch (e) { toast((e as Error).message, 'bad'); } };
  const remove = async (id: string) => { if (!confirm('¿Quitar el acceso de este usuario?')) return; await api(`/businesses/current/members/${id}`, { method: 'DELETE' }); reload(); };
  const PERM_LABELS: Record<string, string> = {
    'business:manage': 'Datos del negocio y plan', 'members:manage': 'Usuarios', 'products:read': 'Ver productos', 'products:write': 'Editar productos',
    'inventory:adjust': 'Ajustar inventario', 'sales:read': 'Ver ventas', 'sales:create': 'Registrar ventas', 'sales:cancel': 'Anular ventas',
    'customers:read': 'Ver clientes', 'customers:write': 'Editar clientes', 'suppliers:read': 'Ver proveedores', 'suppliers:write': 'Editar proveedores',
    'finance:read': 'Ver finanzas', 'finance:write': 'Registrar gastos', 'banks:read': 'Ver bancos', 'banks:write': 'Gestionar bancos',
    'reports:read': 'Reportes', 'social:read': 'Ver redes', 'social:manage': 'Gestionar redes', 'assistant:use': 'Asistente IA', 'audit:read': 'Auditoría',
  };
  return (
    <div className="space-y-5">
      <Card title="Usuarios del negocio" padded={false} actions={<button className="btn-primary btn-sm" onClick={() => { setErr(null); setOpen(true); }}><UserPlus className="h-3.5 w-3.5" /> Agregar usuario</button>}>
        {!data ? <Loading /> : (
          <TableWrap>
            <table className="table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>2FA</th><th>Desde</th><th /></tr></thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id}>
                    <td><p className="font-medium">{m.fullName}</p><p className="text-[11px] text-ink-muted">{m.email}</p><div className="mt-1.5"><SocialIcons links={m.socialLinks} size="sm" /></div></td>
                    <td>{m.roleKey === 'OWNER' ? <Badge tone="ink">Propietario</Badge> : (
                      <select className="input h-8 w-40 text-xs" value={m.roleKey} onChange={(e) => change(m.id, { roleKey: e.target.value })}>{['ADMIN', 'SELLER', 'ACCOUNTANT', 'EMPLOYEE'].map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select>
                    )}</td>
                    <td>{m.status === 'ACTIVE' ? <Badge tone="ok">Activo</Badge> : <Badge>Suspendido</Badge>}</td>
                    <td>{m.twoFactorEnabled ? <ShieldCheck className="h-4 w-4 text-ok" /> : <span className="text-ink-faint text-xs">No</span>}</td>
                    <td className="text-ink-muted">{date(m.createdAt)}</td>
                    <td className="text-right whitespace-nowrap">{m.roleKey !== 'OWNER' && <>
                      <button className="btn-ghost btn-sm" onClick={() => change(m.id, { status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}>{m.status === 'ACTIVE' ? 'Suspender' : 'Activar'}</button>
                      <button className="btn-ghost btn-sm !px-2 text-bad" onClick={() => remove(m.id)} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                    </>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <Card title="Permisos por rol" padded={false}>
        {roles && (
          <TableWrap>
            <table className="table text-xs">
              <thead><tr><th>Permiso</th>{roles.map((r) => <th key={r.key} className="text-center">{r.name}</th>)}</tr></thead>
              <tbody>
                {Object.entries(PERM_LABELS).map(([p, label]) => (
                  <tr key={p}><td>{label}</td>{roles.map((r) => <td key={r.key} className="text-center">{r.permissions.includes(p) ? <Check className="h-4 w-4 text-ok inline" /> : <span className="text-ink-faint">—</span>}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Agregar usuario" footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary" onClick={add} disabled={!f.email || f.fullName.length < 2}>Agregar</button></>}>
        <div className="space-y-3">
          {err && <ErrorBox message={err} />}
          <Field label="Nombre"><input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="Correo"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Rol"><select className="input" value={f.roleKey} onChange={(e) => setF({ ...f, roleKey: e.target.value })}>{['ADMIN', 'SELLER', 'ACCOUNTANT', 'EMPLOYEE'].map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}</select></Field>
          <p className="text-[11px] text-ink-muted">Si la persona no tiene cuenta, recibirá un enlace para crear su contraseña.</p>
        </div>
      </Modal>
    </div>
  );
}

function SecurityTab() {
  const toast = useToast();
  const { user, reload } = useAuth();
  const { data: sessions, reload: reloadSessions } = useApi<any[]>('/auth/sessions');
  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', phone: user?.phone ?? '', socialLinks: (user?.socialLinks ?? {}) as Record<string, string> });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [setup, setSetup] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [disable, setDisable] = useState(false);
  const [dis, setDis] = useState({ password: '', code: '' });
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(null); try { await fn(); toast(ok); } catch (e) { setErr((e as Error).message); } };

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      {err && <div className="lg:col-span-2"><ErrorBox message={err} /></div>}
      <Card title="Perfil">
        <div className="space-y-3">
          <Field label="Nombre"><input className="input" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></Field>
          <Field label="Teléfono"><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
          <Field label="Correo"><input className="input" value={user?.email} disabled /></Field>
          <div className="pt-2">
            <p className="text-sm font-medium">Mis redes sociales personales</p>
            <p className="text-[11px] text-ink-muted mb-3">Son tuyas, distintas a las del negocio. Las ve tu equipo en Usuarios y roles.</p>
            <SocialFields value={profile.socialLinks} onChange={(v) => setProfile({ ...profile, socialLinks: v as Record<string, string> })} />
          </div>
          <button className="btn-secondary" onClick={() => run(async () => { await api('/auth/me', { method: 'PATCH', body: profile, noBusiness: true }); await reload(); }, 'Perfil actualizado')}>Guardar</button>
        </div>
      </Card>
      <Card title="Verificación en dos pasos (2FA)">
        {user?.twoFactorEnabled ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm"><ShieldCheck className="h-5 w-5 text-ok" /> Activa. Se pide un código de tu app autenticadora al ingresar.</p>
            <button className="btn-danger" onClick={() => setDisable(true)}>Desactivar 2FA</button>
          </div>
        ) : setup ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Escanea el código con Google Authenticator, Authy o similar, y escribe el código de 6 dígitos.</p>
            <img src={setup.qrDataUrl} alt="Código QR para 2FA" className="h-44 w-44 rounded-xl border border-line" />
            <p className="text-[11px] text-ink-muted break-all">Clave manual: <span className="font-mono">{setup.secret}</span></p>
            <div className="flex gap-2"><input className="input w-40 tracking-[0.3em] text-center" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <button className="btn-primary" disabled={code.length !== 6} onClick={() => run(async () => { await api('/auth/2fa/enable', { body: { code }, noBusiness: true }); setSetup(null); setCode(''); await reload(); }, 'Verificación en dos pasos activada')}>Activar</button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Protege tu cuenta con un código temporal además de tu contraseña.</p>
            <button className="btn-primary" onClick={() => run(async () => setSetup(await api('/auth/2fa/setup', { method: 'POST', noBusiness: true })), 'Escanea el código QR')}>Configurar 2FA</button>
          </div>
        )}
      </Card>
      <Card title="Cambiar contraseña">
        <div className="space-y-3">
          <Field label="Contraseña actual"><input className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números. Se cerrarán tus otras sesiones."><input className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <button className="btn-secondary" onClick={() => run(async () => { await api('/auth/password/change', { body: pw, noBusiness: true }); setPw({ currentPassword: '', newPassword: '' }); reloadSessions(); }, 'Contraseña actualizada')}>Actualizar contraseña</button>
        </div>
      </Card>
      <Card title="Sesiones activas" padded={false} actions={<button className="btn-ghost btn-sm" onClick={() => run(async () => { await api('/auth/logout-all', { method: 'POST', noBusiness: true }); window.location.href = '/ingresar'; }, 'Sesiones cerradas')}>Cerrar todas</button>}>
        <ul className="divide-y divide-line">
          {sessions?.map((s) => (
            <li key={s.id} className="px-5 py-3 flex items-center gap-3">
              <Monitor className="h-4 w-4 text-sand-500" />
              <div className="flex-1 min-w-0"><p className="text-sm truncate">{s.userAgent?.replace(/\(.*?\)/g, '').slice(0, 60) || 'Dispositivo'}</p><p className="text-[11px] text-ink-muted">{s.ip} · último uso {date(s.lastUsedAt, true)}</p></div>
              {s.current ? <Badge tone="ok">Esta sesión</Badge> : <button className="btn-ghost btn-sm text-bad" onClick={() => run(async () => { await api(`/auth/sessions/${s.id}`, { method: 'DELETE', noBusiness: true }); reloadSessions(); }, 'Sesión cerrada')}>Cerrar</button>}
            </li>
          ))}
        </ul>
      </Card>
      <Modal open={disable} onClose={() => setDisable(false)} title="Desactivar 2FA" footer={<><button className="btn-ghost" onClick={() => setDisable(false)}>Cancelar</button><button className="btn-danger" onClick={() => run(async () => { await api('/auth/2fa/disable', { body: dis, noBusiness: true }); setDisable(false); await reload(); }, '2FA desactivada')}>Desactivar</button></>}>
        <div className="space-y-3">
          <Field label="Contraseña"><input className="input" type="password" value={dis.password} onChange={(e) => setDis({ ...dis, password: e.target.value })} /></Field>
          <Field label="Código actual de tu app"><input className="input" inputMode="numeric" maxLength={6} value={dis.code} onChange={(e) => setDis({ ...dis, code: e.target.value.replace(/\D/g, '') })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

function NotificationsTab() {
  const toast = useToast();
  const { data, setData } = useApi<any[]>('/notifications/preferences');
  const toggle = async (type: string, enabled: boolean) => {
    const r = await api('/notifications/preferences', { method: 'PUT', body: { preferences: { [type]: enabled } } });
    setData(r); toast('Preferencia guardada');
  };
  return (
    <Card title="¿Qué notificaciones quieres recibir?" className="max-w-2xl">
      {!data ? <Loading /> : (
        <ul className="divide-y divide-line -mx-5">
          {data.map((p) => (
            <li key={p.type} className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm">{p.label}</span>
              <button role="switch" aria-checked={p.enabled} onClick={() => toggle(p.type, !p.enabled)} className={`h-6 w-11 rounded-full transition relative ${p.enabled ? 'bg-primary' : 'bg-sand-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${p.enabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-ink-faint mt-3">Las notificaciones aparecen en la campana. El envío por correo y WhatsApp se habilitará con un proveedor de mensajería.</p>
    </Card>
  );
}

function PlanTab() {
  const { data: current, reload: reloadCurrent } = useApi<any>('/businesses/current/plan');
  const { data: plans } = useApi<any[]>('/plans');
  const { data: billing, error: billingError, reload: reloadBilling } = useApi<any>('/billing/current');
  const params = useSearchParams();
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (params.get('payment') !== 'return') return;
    let attempts = 0;
    const timer = window.setInterval(() => { reloadBilling(); reloadCurrent(); attempts += 1; if (attempts >= 10) window.clearInterval(timer); }, 3000);
    return () => window.clearInterval(timer);
  }, [params, reloadBilling, reloadCurrent]);
  if (billingError) return <ErrorBox message={billingError} />;
  if (!current || !plans || !billing) return <Loading />;
  const lim = (v: number | null) => (v === null ? 'Ilimitado' : number(v));
  const pay = async (planCode: string) => {
    setPaying(planCode); setError(null);
    try {
      const result = await api<any>('/billing/current/checkout', { method: 'POST', body: { planCode } });
      const checkout = result.checkout;
      const form = document.createElement('form'); form.method = 'GET'; form.action = checkout.url;
      const values: Record<string, string> = { 'public-key': checkout.publicKey, currency: checkout.currency,
        'amount-in-cents': checkout.amountInCents, reference: checkout.reference,
        'signature:integrity': checkout.signature, 'acceptance-token': checkout.acceptanceToken,
        'redirect-url': checkout.redirectUrl, 'customer-data:email': checkout.email };
      Object.entries(values).forEach(([name, value]) => { const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input); });
      document.body.appendChild(form); form.submit(); form.remove();
    } catch (e) { setError((e as Error).message); setPaying(null); }
  };
  const paymentStatus: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagado', FAILED: 'No aprobado' };
  const usage = [
    ['Usuarios', current.usage.users, current.limits.users], ['Productos', current.usage.products, current.limits.products],
    ['Ventas este mes', current.usage.salesPerMonth, current.limits.salesPerMonth], ['Cuentas bancarias', current.usage.bankAccounts, current.limits.bankAccounts],
  ] as const;
  return (
    <div className="space-y-5">
      <Card title="Plan y pagos">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm">Plan activo: <span className="font-semibold">{billing.subscription.planName}</span></p>
            <p className="text-xs text-ink-muted mt-1">Estado: {billing.subscription.status === 'ACTIVE' ? 'Activo' : billing.subscription.status}
              {billing.subscription.currentPeriodEnd ? ` · Vigente hasta ${date(billing.subscription.currentPeriodEnd)}` : ''}</p>
          </div>
          <Badge tone={billing.configured ? 'ok' : 'sand'}>{billing.configured ? 'Pagos en línea disponibles' : 'Pago en línea por configurar'}</Badge>
        </div>
        <div className="mt-4 rounded-xl bg-sand-50 border border-line p-4 text-xs text-ink-muted">
          <p className="font-medium text-ink">Método de pago: Wompi</p>
          <p className="mt-1">Al continuar podrás elegir los medios habilitados en el checkout seguro de Wompi. DREAMS no guarda números de tarjetas.</p>
          <p className="mt-1">El plan se activa cuando Wompi confirma el pago. El cobro mensual es manual por ahora; recibirás el estado y el historial aquí.</p>
        </div>
        {!billing.configured && <p className="mt-3 text-xs text-ink-muted">El administrador de DREAMS debe configurar las llaves del comercio Wompi en el servidor para habilitar los pagos.</p>}
        {params.get('payment') === 'return' && <p className="mt-3 text-sm text-primary">Regresaste del checkout. Estamos esperando la confirmación del pago; esta página se actualizará cuando llegue.</p>}
        {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      </Card>
      <Card title={`Plan actual: ${current.name}`}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {usage.map(([label, used, max]) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1"><span className="text-ink-muted">{label}</span><span className="tabular-nums">{number(used)} / {lim(max)}</span></div>
              <div className="h-2 rounded-full bg-sand-100 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${max ? Math.min(100, (used / max) * 100) : 6}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => (
          <div key={p.code} className={`rounded-2xl border p-5 ${p.code === current.code ? 'bg-primary text-on-primary border-primary' : 'bg-white border-line'}`}>
            <p className="text-sm font-medium">{p.name}</p>
            <p className="text-2xl font-semibold mt-1">{money(p.priceMonthly)}<span className="text-xs font-normal opacity-60"> /mes</span></p>
            <ul className="text-xs mt-4 space-y-1.5 opacity-90">
              <li>{lim(p.limits.users)} usuario(s)</li><li>{lim(p.limits.products)} productos</li><li>{lim(p.limits.salesPerMonth)} ventas/mes</li>
              <li>{lim(p.limits.bankAccounts)} cuentas bancarias</li><li>Reportes: {p.limits.reportFormats.join(', ').toUpperCase()}</li>
              {p.limits.processWatches !== undefined && <li>{lim(p.limits.processWatches)} procesos vigilados (abogados)</li>}
              {p.limits.whatsappAlerts !== undefined && <li>{p.limits.whatsappAlerts ? 'Avisos por WhatsApp' : 'Sin avisos por WhatsApp'}</li>}
            </ul>
            {p.code === current.code ? <p className="text-xs mt-4 text-on-primary/70">Tu plan actual</p> : p.code === 'FREE' ? <p className="text-xs mt-4 text-ink-muted">Plan gratuito</p> : <button className="btn-secondary btn-sm w-full mt-4" onClick={() => pay(p.code)} disabled={!billing.configured || !!paying}>
              {paying === p.code ? <><Spinner /> Abriendo pago…</> : `Elegir ${p.name}`}
            </button>}
          </div>
        ))}
      </div>
      <Card title="Historial de pagos" padded={false}>
        {!billing.payments.length ? <p className="p-5 text-sm text-ink-muted">Aún no tienes pagos de planes registrados.</p> : <TableWrap><table className="table">
          <thead><tr><th>Fecha</th><th>Plan</th><th>Medio</th><th>Valor</th><th>Estado</th></tr></thead>
          <tbody>{billing.payments.map((payment: any) => <tr key={payment.id}>
            <td>{date(payment.paidAt ?? payment.createdAt, true)}</td><td>{plans.find((p) => p.code === payment.targetPlanCode)?.name ?? payment.targetPlanCode ?? '—'}</td>
            <td>{payment.paymentMethod ?? 'Wompi'}</td><td>{money(payment.amount)}</td>
            <td><Badge tone={payment.status === 'PAID' ? 'ok' : payment.status === 'FAILED' ? 'bad' : 'sand'}>{paymentStatus[payment.status] ?? payment.status}</Badge></td>
          </tr>)}</tbody>
        </table></TableWrap>}
      </Card>
    </div>
  );
}

function AuditTab() {
  const { data } = useApi<any[]>('/audit-logs?pageSize=100');
  const ACT: Record<string, string> = { CREATE: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó' };
  return (
    <Card title="Registro de actividad" padded={false}>
      {!data ? <Loading /> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Recurso</th><th>IP</th></tr></thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td className="text-ink-muted whitespace-nowrap">{date(a.createdAt, true)}</td>
                  <td>{a.userName ?? '—'}</td>
                  <td><Badge tone={a.action === 'DELETE' ? 'bad' : a.action === 'CREATE' ? 'ok' : 'sand'}>{ACT[a.action] ?? a.action}</Badge></td>
                  <td className="font-mono text-xs">{a.path?.path ?? a.entity}</td>
                  <td className="text-ink-muted text-xs">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  );
}
