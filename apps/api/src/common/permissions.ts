/** Catálogo de permisos y roles del sistema. Fuente única de verdad (se siembra en la BD). */
export const PERMISSIONS = [
  'business:manage', 'members:manage',
  'products:read', 'products:write', 'inventory:adjust',
  'sales:read', 'sales:create', 'sales:cancel',
  'customers:read', 'customers:write',
  'suppliers:read', 'suppliers:write',
  'finance:read', 'finance:write',
  'banks:read', 'banks:write',
  'reports:read',
  'social:read', 'social:manage',
  'assistant:use',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type SystemRoleKey = 'OWNER' | 'ADMIN' | 'SELLER' | 'ACCOUNTANT' | 'EMPLOYEE';

const ALL = [...PERMISSIONS];

export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; permissions: Permission[] }> = {
  OWNER: { name: 'Propietario', permissions: ALL },
  ADMIN: { name: 'Administrador', permissions: ALL },
  SELLER: {
    name: 'Vendedor',
    permissions: ['products:read', 'sales:read', 'sales:create', 'customers:read', 'customers:write', 'social:read'],
  },
  ACCOUNTANT: {
    name: 'Contador',
    permissions: [
      'products:read', 'sales:read', 'customers:read', 'suppliers:read',
      'finance:read', 'finance:write', 'banks:read', 'reports:read', 'assistant:use',
    ],
  },
  EMPLOYEE: {
    name: 'Empleado',
    permissions: [
      'products:read', 'products:write', 'inventory:adjust', 'sales:read', 'sales:create',
      'customers:read', 'customers:write', 'suppliers:read',
    ],
  },
};
