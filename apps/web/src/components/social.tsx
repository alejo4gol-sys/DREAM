'use client';
import { Facebook, Instagram, Linkedin, MessageCircle, Music2, Twitter, Youtube } from 'lucide-react';
import { Field } from './ui';

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@usuario', url: (h: string) => `https://instagram.com/${h}` },
  { key: 'tiktok', label: 'TikTok', icon: Music2, placeholder: '@usuario', url: (h: string) => `https://www.tiktok.com/@${h}` },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'usuario o enlace', url: (h: string) => `https://facebook.com/${h}` },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, placeholder: '+57 300 000 0000', url: (h: string) => `https://wa.me/${h.replace(/\D/g, '')}` },
  { key: 'x', label: 'X (Twitter)', icon: Twitter, placeholder: '@usuario', url: (h: string) => `https://x.com/${h}` },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: '@canal', url: (h: string) => `https://youtube.com/@${h}` },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'usuario o enlace', url: (h: string) => `https://www.linkedin.com/in/${h}` },
] as const;

export type SocialLinks = Partial<Record<(typeof SOCIALS)[number]['key'], string>>;

/** Construye un enlace seguro: solo http(s); un @usuario se convierte en la URL oficial de la red. */
export function socialHref(key: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  const s = SOCIALS.find((x) => x.key === key);
  return s ? s.url(encodeURIComponent(v.replace(/^@/, ''))) : null;
}

/** Campos editables de redes sociales. */
export function SocialFields({ value, onChange, columns = 2 }: { value: SocialLinks; onChange: (v: SocialLinks) => void; columns?: 2 | 3 }) {
  return (
    <div className={`grid gap-3 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {SOCIALS.map((s) => (
        <Field key={s.key} label={s.label}>
          <div className="relative">
            <s.icon className="h-4 w-4 absolute left-3 top-3 text-sand-500" />
            <input className="input pl-9" maxLength={200} placeholder={s.placeholder} value={value[s.key] ?? ''}
              onChange={(e) => onChange({ ...value, [s.key]: e.target.value })} />
          </div>
        </Field>
      ))}
    </div>
  );
}

/** Íconos con enlace a cada red registrada. */
export function SocialIcons({ links, size = 'md' }: { links?: Record<string, string> | null; size?: 'sm' | 'md' }) {
  const items = SOCIALS.filter((s) => links?.[s.key]);
  if (!items.length) return null;
  const box = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => {
        const href = socialHref(s.key, links![s.key]!);
        const inner = <s.icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />;
        return href ? (
          <a key={s.key} href={href} target="_blank" rel="noopener noreferrer" title={`${s.label}: ${links![s.key]}`} onClick={(e) => e.stopPropagation()}
            className={`${box} rounded-lg bg-sand-100 hover:bg-sand-200 text-ink flex items-center justify-center`}>{inner}</a>
        ) : <span key={s.key} title={links![s.key]} className={`${box} rounded-lg bg-sand-100 flex items-center justify-center`}>{inner}</span>;
      })}
    </div>
  );
}

/** Lista legible (ícono + usuario) para fichas de detalle. */
export function SocialList({ links }: { links?: Record<string, string> | null }) {
  const items = SOCIALS.filter((s) => links?.[s.key]);
  if (!items.length) return <p className="text-sm text-ink-muted">Sin redes registradas.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((s) => {
        const href = socialHref(s.key, links![s.key]!);
        return (
          <li key={s.key} className="flex gap-2 items-center">
            <s.icon className="h-4 w-4 text-sand-500 shrink-0" />
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{links![s.key]}</a> : <span className="truncate">{links![s.key]}</span>}
          </li>
        );
      })}
    </ul>
  );
}
