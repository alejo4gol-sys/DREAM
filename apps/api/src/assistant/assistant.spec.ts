import { detectPeriod, norm, parseGoal } from './assistant.module';

describe('asistente: interpretación de preguntas', () => {
  it('detecta períodos', () => {
    expect(detectPeriod(norm('¿Cuánto vendí hoy?'))).toBe('today');
    expect(detectPeriod(norm('ventas de esta semana'))).toBe('week');
    expect(detectPeriod(norm('¿Cuánto vendí el mes pasado?'))).toBe('lastMonth');
    expect(detectPeriod(norm('mejor día del año'))).toBe('year');
    expect(detectPeriod(norm('¿Cuánto vendí?'))).toBe('month');
  });

  it('interpreta metas en pesos', () => {
    expect(parseGoal('alcanzar 10 millones')).toBe(10_000_000);
    expect(parseGoal('alcanzar 10.000.000')).toBe(10_000_000);
    expect(parseGoal('meta de 2,5 millones')).toBe(2_500_000);
    expect(parseGoal('meta de 500 mil')).toBe(500_000);
    expect(parseGoal('sin numero')).toBeNull();
  });
});

import { rank } from './assistant.module';
describe('asistente: búsqueda en la base de conocimiento', () => {
  const docs = [
    { title: 'Limpieza facial profunda', text: 'Llega con el rostro sin maquillaje. Después evita el sol 48 horas y usa protector.', source: 'Guía' },
    { title: 'Envíos, domicilios y entregas', text: 'El envío cuesta $8.000 y es gratis desde $150.000.', source: 'Página web' },
    { title: 'Cambios y devoluciones', text: 'Tienes 30 días para devolver el producto con su empaque.', source: 'Políticas' },
  ];
  it('encuentra la guía de uso de un servicio', () => {
    expect(rank(docs, '¿Qué cuidados debo tener después de la limpieza facial?')[0].doc.title).toBe('Limpieza facial profunda');
  });
  it('encuentra envíos y devoluciones', () => {
    expect(rank(docs, '¿Cuánto cuesta el envío a domicilio?')[0].doc.title).toMatch(/Envíos/);
    expect(rank(docs, '¿Puedo devolver un producto?')[0].doc.title).toBe('Cambios y devoluciones');
  });
});
