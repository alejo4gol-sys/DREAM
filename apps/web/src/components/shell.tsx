'use client';
import { Bell, Bot, Boxes, Building2, Calculator, Briefcase, CalendarDays, ChevronDown, CircleHelp, ClipboardList, FileBarChart, FileText, GraduationCap, Hourglass, Inbox, Landmark, LayoutDashboard, LogOut, Megaphone, Menu, Package, Receipt, Scale, RotateCcw, Settings, Share2, ShoppingBag, Store, Tags, Truck, Users, Wallet, X, Radar, Zap, BookOpen, FileSignature, Ticket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import { tutorialsFor } from '@/lib/tutorials';
import { profileFor } from '@/lib/service-profiles';
import { TutorialProvider, useTutorial } from './tutorial';
import { Logo, cn, useToast } from './ui';
import { HELP_BRAND } from '@/lib/help-brand';

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'sales:read' },
  { href: '/ventas', label: 'Ventas', icon: ShoppingBag, perm: 'sales:read' },
  { href: '/venta-rapida', label: 'Venta rápida', icon: Zap, perm: 'sales:create' },
  { href: '/facturas', label: 'Facturas', icon: FileText, perm: 'sales:read' },
  { href: '/productos', label: 'Productos', icon: Package, perm: 'products:read' },
  { href: '/comparar-precios', label: 'Precios del mercado', icon: Tags, perm: 'products:read' },
  { href: '/mi-tienda', label: 'Mi página web', icon: Store, perm: 'business:manage' },
  { href: '/pedidos-web', label: 'Pedidos y envíos', icon: ShoppingBag, perm: 'sales:read' },
  { href: '/devoluciones', label: 'Devoluciones', icon: RotateCcw, perm: 'sales:read' },
  { href: '/inventario', label: 'Inventario', icon: Boxes, perm: 'products:read' },
  { href: '/clientes', label: 'Clientes', icon: Users, perm: 'customers:read' },
  { href: '/proveedores', label: 'Proveedores', icon: Truck, perm: 'suppliers:read' },
  { href: '/mayoristas', label: 'Ventas al por mayor', icon: Building2, perm: 'customers:read' },
  { href: '/catalogo', label: 'Catálogo para compartir', icon: BookOpen, perm: 'products:read' },
  { href: '/bancos', label: 'Bancos', icon: Landmark, perm: 'banks:read' },
  { href: '/finanzas', label: 'Finanzas', icon: Wallet, perm: 'finance:read' },
  { href: '/contabilidad', label: 'Contabilidad', icon: Calculator, perm: 'finance:read' },
  { href: '/redes', label: 'Redes sociales', icon: Share2, perm: 'social:read' },
  { href: '/publicidad', label: 'Publicidad', icon: Megaphone, perm: 'social:read' },
  { href: '/reportes', label: 'Reportes', icon: FileBarChart, perm: 'reports:read' },
  { href: '/asistente', label: 'Asistente IA', icon: Bot, perm: 'assistant:use' },
  { href: '/configuracion', label: 'Configuración', icon: Settings, perm: null },
];

/** Menú para negocios de servicios (abogados, técnicos, salones…): agenda y casos/órdenes en vez de pedidos e inventario. */
export function navFor(model?: string | null, profile?: string | null) {
  if (model !== 'SERVICES') return NAV;
  const p = profileFor(profile);
  const item = (href: string) => NAV.find((n) => n.href === href)!;
  return [
    item('/dashboard'),
    { href: '/agenda', label: 'Agenda', icon: CalendarDays, perm: 'sales:read' },
    { ...item('/pedidos-web'), label: 'Reservas web' },
    { href: '/trabajos', label: p.job.nav, icon: ClipboardList, perm: 'sales:read' },
    ...(profile === 'LEGAL' ? [{ href: '/terminos', label: 'Términos y vencimientos', icon: Hourglass, perm: 'sales:read' }, { href: '/procesos', label: 'Seguimiento de procesos', icon: Radar, perm: 'sales:read' }, { href: '/solicitudes', label: `Clientes de ${HELP_BRAND.name}`, icon: Inbox, perm: 'sales:read' }] : []),
    { href: '/honorarios', label: profile === 'LEGAL' ? 'Calculadora de honorarios' : 'Cotizador de tarifas', icon: profile === 'LEGAL' ? Scale : Receipt, perm: 'sales:read' },
    ...(profile === 'LEGAL' ? [{ href: '/plantillas', label: 'Plantillas y documentos', icon: FileSignature, perm: 'sales:read' }] : []),
    { href: '/servicios', label: p.partsLabel ? `Servicios y ${p.partsLabel.toLowerCase()}` : 'Servicios', icon: Briefcase, perm: 'products:read' },
    { href: '/paquetes', label: 'Paquetes y membresías', icon: Ticket, perm: 'products:read' },
    item('/clientes'),
    { ...item('/ventas'), label: 'Cobros' },
    item('/facturas'),
    ...(p.partsLabel ? [{ ...item('/inventario'), label: `Inventario de ${p.partsLabel.toLowerCase()}` }, item('/proveedores')] : []),
    item('/mi-tienda'), item('/catalogo'), item('/finanzas'), item('/contabilidad'), item('/bancos'), item('/redes'), item('/publicidad'), item('/reportes'), item('/asistente'), item('/configuracion'),
  ];
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, current } = useAuth();
  const tutorial = useTutorial();
  const [admin, setAdmin] = useState(false);
  const [support, setSupport] = useState<string | null>(null);
  useEffect(() => { api<any>('/growth/admin/me').then((r) => setAdmin(!!r.admin)).catch(() => null); }, [current?.businessId]);
  useEffect(() => { api<any>('/growth/support', { noBusiness: true }).then((r) => setSupport(r.whatsapp)).catch(() => null); }, []);
  const items = [...navFor(current?.businessModel, current?.serviceProfile), ...(admin ? [{ href: '/admin', label: 'Administración DREAMS', icon: ShieldCheck, perm: null }] : [])];
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5"><Link href="/dashboard" onClick={onNavigate}><Logo inverted /></Link></div>
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" aria-label="Menú principal">
        {items.filter((n) => !n.perm || can(n.perm)).map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <div key={n.href} className="group relative">
              <Link href={n.href} onClick={onNavigate}
                className={cn('flex items-center gap-3 pl-3 pr-10 h-10 rounded-xl text-[13px] transition',
                  active ? 'bg-sand-50 text-ink font-medium' : 'text-on-primary/75 hover:text-on-primary hover:bg-on-primary/10')}>
                <n.icon className={cn('h-[18px] w-[18px]', active ? 'text-ink' : 'text-on-primary/60')} />
                {n.label}
              </Link>
              {tutorialsFor(current?.businessModel)[n.href] && <Link href={n.href} onClick={() => { tutorial.open(n.href); onNavigate?.(); }}
                title={`Ver tutorial de ${n.label}`} aria-label={`Ver tutorial de ${n.label}`}
                className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center transition',
                  active ? 'text-ink-muted hover:text-ink hover:bg-sand-100' : 'text-on-primary/35 hover:text-on-primary hover:bg-on-primary/10 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100')}>
                <CircleHelp className="h-4 w-4" />
              </Link>}
            </div>
          );
        })}
      </nav>
      <div className="p-4 m-3 rounded-xl bg-on-primary/10 text-[11px] text-on-primary/70">
        <p className="text-on-primary font-medium">{current?.tradeName}</p>
        <p>{current?.roleName}</p>
        {support && <a href={`https://wa.me/${support}?text=${encodeURIComponent(`Hola, soy de ${current?.tradeName ?? 'un negocio'} y necesito ayuda con DREAMS.`)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-on-primary font-medium hover:underline">Ayuda por WhatsApp</a>}
      </div>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: any[]; unread: number }>({ items: [], unread: 0 });
  const { current } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const load = () => api('/notifications').then(setData).catch(() => undefined);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [current?.businessId]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }); load(); };
  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost !px-2.5 relative" onClick={() => setOpen((o) => !o)} aria-label="Notificaciones">
        <Bell className="h-[18px] w-[18px]" />
        {data.unread > 0 && <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] text-on-primary flex items-center justify-center">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,360px)] card shadow-pop z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold">Notificaciones</p>
            {data.unread > 0 && <button className="text-xs text-ink-muted hover:text-ink" onClick={readAll}>Marcar todo como leído</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.items.length === 0 && <p className="text-sm text-ink-muted p-6 text-center">Sin notificaciones</p>}
            {data.items.map((n) => (
              <div key={n.id} className={cn('px-4 py-3 border-b border-line/60 last:border-0', !n.readAt && 'bg-sand-50')}>
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sand-500 shrink-0" />}
                  <div className="min-w-0">
                    {n.data?.processWatchId ? <Link href={`/procesos?abrir=${n.data.processWatchId}`} className="text-sm font-medium hover:underline" onClick={() => setOpen(false)}>{n.title}</Link>
                      : n.data?.legalTermId ? <Link href="/terminos" className="text-sm font-medium hover:underline" onClick={() => setOpen(false)}>{n.title}</Link>
                        : <p className="text-sm font-medium">{n.title}</p>}
                    <p className="text-xs text-ink-muted mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-ink-faint mt-1">{relative(n.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link href="/configuracion?tab=notificaciones" className="block text-center text-xs text-ink-muted hover:text-ink py-2.5 border-t border-line" onClick={() => setOpen(false)}>Configurar notificaciones</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, businesses, current, switchBusiness, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const tutorial = useTutorial();
  const toast = useToast();
  const initials = user?.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-2 rounded-xl pl-1 pr-2 h-10 hover:bg-sand-100" onClick={() => setOpen((o) => !o)}>
        <span className="h-8 w-8 rounded-lg bg-sand-200 text-sand-600 text-xs font-semibold flex items-center justify-center">{initials}</span>
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-xs font-medium">{user?.fullName}</span>
          <span className="block text-[10px] text-ink-muted">{current?.tradeName}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 card shadow-pop z-40 py-2">
          <p className="px-4 pt-1 pb-2 text-[11px] uppercase tracking-wider text-ink-faint">Negocios</p>
          {businesses.map((b) => (
            <button key={b.businessId} onClick={() => { switchBusiness(b.businessId); setOpen(false); router.refresh(); }}
              className={cn('w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-sand-50', b.businessId === current?.businessId && 'font-medium')}>
              <Building2 className="h-4 w-4 text-sand-500" /> <span className="truncate flex-1">{b.tradeName}</span>
              <span className="text-[10px] text-ink-faint">{b.roleName}</span>
            </button>
          ))}
          <Link href="/bienvenida?nuevo=1" className="block px-4 py-2 text-sm text-ink-muted hover:bg-sand-50" onClick={() => setOpen(false)}>+ Registrar otro negocio</Link>
          <div className="border-t border-line my-2" />
          <Link href="/configuracion?tab=seguridad" className="block px-4 py-2 text-sm hover:bg-sand-50" onClick={() => setOpen(false)}>Mi cuenta y seguridad</Link>
          <button className="w-full text-left px-4 py-2 text-sm hover:bg-sand-50 flex items-center gap-2" onClick={async () => { setOpen(false); await tutorial.resetAll(); toast('Listo: verás de nuevo el tutorial al entrar a cada sección'); }}>
            <GraduationCap className="h-4 w-4 text-sand-500" /> Ver de nuevo todos los tutoriales
          </button>
          <button className="w-full text-left px-4 py-2 text-sm text-bad hover:bg-red-50 flex items-center gap-2" onClick={async () => { await logout(); router.replace('/ingresar'); }}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function TutorialButton() {
  const { current, open } = useTutorial();
  const auth = useAuth();
  const pathname = usePathname();
  if (!current) return null;
  const all = tutorialsFor(auth.current?.businessModel);
  const href = Object.keys(all).find((h) => all[h].key === current.key) ?? pathname;
  return <button className="btn-ghost !px-2.5 sm:!px-3 text-xs" onClick={() => open(href)} title={`Ver tutorial de ${current.title}`}>
    <CircleHelp className="h-[18px] w-[18px]" /><span className="hidden sm:inline">Tutorial</span>
  </button>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // App instalable en el celular (PWA): manifiesto y service worker solo dentro del panel del negocio.
  useEffect(() => {
    if (!document.querySelector('link[rel="manifest"]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/manifest.webmanifest'; document.head.appendChild(l); }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => null);
  }, []);
  return <TutorialProvider><Shell>{children}</Shell></TutorialProvider>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobile(false), [pathname]);
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-primary no-print"><Sidebar /></aside>
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-primary">
            <button className="absolute top-4 right-3 text-on-primary/80 p-2" onClick={() => setMobile(false)} aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
            <Sidebar onNavigate={() => setMobile(false)} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 h-16 bg-sand-50/85 backdrop-blur border-b border-line flex items-center justify-between px-4 sm:px-6 no-print">
        <div className="flex items-center gap-2">
          <button className="lg:hidden btn-ghost !px-2" onClick={() => setMobile(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <span className="lg:hidden"><Logo /></span>
        </div>
        <div className="flex items-center gap-1"><TutorialButton /><Notifications /><UserMenu /></div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
