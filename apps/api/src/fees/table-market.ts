import { FeeItem, FeeTable, Formula } from './fee-types';

/**
 * Tarifas de referencia para otras profesiones. Cada valor sale de una fuente pública citada (consultadas en octubre de 2026).
 * Donde no encontramos una fuente confiable no inventamos precios: la persona agrega su propio concepto.
 */
const r = (key: string, area: string, label: string, min: number, max: number, source: string, extra: Partial<FeeItem> = {}): FeeItem =>
  ({ key, area, label, f: { range: [min, max] }, source, ...extra });
const p = (key: string, area: string, label: string, f: Formula, extra: Partial<FeeItem> = {}): FeeItem => ({ key, area, label, f, ...extra });

const MARKET_DISCLAIMER = 'Rangos de mercado publicados por las fuentes citadas, no son tarifas oficiales. El valor sugerido depende del nivel de precio y la ciudad que elijas; ajústalo a tu experiencia, tus costos y tu clientela.';

export const ACCOUNTING_TABLE: FeeTable = {
  key: 'ACCOUNTING', profile: 'CONSULTING', title: 'Honorarios de contadores públicos (mercado 2026)', profession: 'Contadores', kind: 'MARKET',
  areas: [{ key: 'RENTA', label: 'Declaración de renta' }, { key: 'MENSUAL', label: 'Contabilidad mensual' }, { key: 'ASESORIA', label: 'Asesoría' }],
  items: [
    r('C-RENTA-BAS', 'RENTA', 'Declaración de renta persona natural — básica (un ingreso, pocos movimientos)', 150_000, 350_000, 'KONRAD', { tags: 'DIAN impuestos' }),
    r('C-RENTA-SIM', 'RENTA', 'Declaración de renta persona natural — simple', 200_000, 500_000, 'CMC'),
    r('C-RENTA-INT', 'RENTA', 'Declaración de renta — intermedia (varios ingresos, inmuebles o inversiones)', 400_000, 1_200_000, 'KONRAD'),
    r('C-RENTA-EXT', 'RENTA', 'Declaración de renta con activos en el exterior o varios inmuebles', 800_000, 1_500_000, 'CMC'),
    r('C-RENTA-COMP', 'RENTA', 'Declaración completa (persona jurídica, alto patrimonio, planeación tributaria)', 1_500_000, 3_500_000, 'KONRAD'),
    p('C-RENTA-EXITO', 'RENTA', 'Cobro por resultados sobre saldo a favor', { pct: 12.5 }, { base: 'Saldo a favor obtenido', success: true, source: 'CMC', note: 'El mercado cobra entre 10 % y 15 % del saldo a favor; DREAMS usa 12,5 %.' }),
    r('C-MES-PN', 'MENSUAL', 'Contabilidad mensual — persona natural básica', 350_000, 600_000, 'CMC', { unit: 'mes' }),
    r('C-MES-PYME', 'MENSUAL', 'Contabilidad mensual — pyme (IVA, retenciones, estados financieros)', 800_000, 1_500_000, 'CMC', { unit: 'mes' }),
    r('C-MES-MED', 'MENSUAL', 'Contabilidad completa — empresa mediana con nómina', 1_500_000, 3_000_000, 'CMC', { unit: 'mes' }),
    r('C-HORA', 'ASESORIA', 'Hora de consultoría contable o tributaria', 50_000, 150_000, 'CMC', { unit: 'hora' }),
  ],
  sources: [
    { key: 'CMC', label: 'cuantomecuesta.com — ¿Cuánto cuesta un contador en Colombia? (2026)', url: 'https://cuantomecuesta.com/co/contador/', note: 'Rangos de Bogotá; las ciudades intermedias suelen ser 20 % a 30 % más baratas.' },
    { key: 'KONRAD', label: 'Infobae (27 jul 2026), citando a la Fundación Universitaria Konrad Lorenz', url: 'https://www.infobae.com/colombia/2026/07/27/declaracion-de-renta-en-la-dian-esto-es-lo-que-deberia-cobrar-un-contador-publico-para-hacer-la-diliegencia-en-2026/' },
    { key: 'CTCP', label: 'Consejo Técnico de la Contaduría Pública — tarifas de referencia', url: 'https://actualicese.com/tabla-de-tarifas-de-honorarios-profesionales-para-contadores-publicos/', note: 'El CTCP aclaró que no le corresponde fijar tarifas; son referenciales y no obligatorias.' },
  ],
  disclaimer: MARKET_DISCLAIMER,
};

export const ARCHITECTURE_TABLE: FeeTable = {
  key: 'ARCHITECTURE', profile: 'CONSULTING', title: 'Honorarios de arquitectura (Decreto 2090 de 1989)', profession: 'Arquitectos', kind: 'TARIFF',
  areas: [{ key: 'DISENO', label: 'Diseño arquitectónico' }, { key: 'OBRA', label: 'Interventoría y construcción' }, { key: 'OTROS', label: 'Presupuestos y control' }],
  items: [
    p('A-APS', 'DISENO', 'Anteproyecto, proyecto y supervisión — vivienda unifamiliar, bifamiliar o trifamiliar (categoría E)', { pct: 9.1 }, {
      base: 'Costo de la construcción (CBT)', source: 'D2090', ref: '1.2.4',
      variants: [
        { key: 'A', label: 'Categoría A — construcciones simples (bodegas, hangares, campamentos)', f: { pct: 3.5 } },
        { key: 'B', label: 'Categoría B — sencillas (escuelas, comercio simple, estaciones de servicio)', f: { pct: 4.9 } },
        { key: 'C', label: 'Categoría C — complejas (edificios de vivienda, oficinas, colegios, iglesias)', f: { pct: 5.95 } },
        { key: 'D', label: 'Categoría D — especial complejidad (hoteles, clínicas, teatros, aeropuertos)', f: { pct: 7 } },
        { key: 'I', label: 'Categoría I — reformas y ampliaciones (C + 10 %)', f: { pct: 6.55 } },
        { key: 'H', label: 'Categoría H — restauración (C + 20 %)', f: { pct: 7.14 } },
      ],
      note: 'Honorario básico del 7 % para los primeros 1.000 m² multiplicado por el factor de la categoría (A 50 %, B 70 %, C 85 %, D 100 %, E 130 %). De 1.000 a 5.000 m² el básico baja a 5 %, de 5.000 a 10.000 m² a 4 % y desde 10.000 m² a 3 %.',
      tags: 'casa planos licencia diseño',
    }),
    p('A-URB', 'DISENO', 'Diseño de urbanismo (no vivienda)', { pct: 10 }, { base: 'Valor estimado de las obras de urbanismo', source: 'D2090', ref: '2.2' }),
    p('A-INT-PROY', 'OBRA', 'Interventoría de proyecto', { pct: 15 }, { base: 'Honorario de diseño (AP y S)', source: 'D2090', ref: '6.2.1' }),
    p('A-INT-OBRA', 'OBRA', 'Interventoría de construcción — categorías A, B, C, D, F, G', { pct: 2.5 }, { base: 'Costo real de la construcción', source: 'D2090', ref: '6.2.2', variants: [{ key: 'EHI', label: 'Categorías E, H, I (vivienda, restauración, reformas)', f: { pct: 4 } }] }),
    p('A-ADM', 'OBRA', 'Construcción por administración delegada', { pct: 10 }, { base: 'Costo real de la construcción', source: 'D2090', ref: '7.2.1', variants: [{ key: 'H', label: 'Restauración', f: { pct: 17 } }, { key: 'I', label: 'Reformas y ampliaciones', f: { pct: 14 } }] }),
    p('A-PRES', 'OTROS', 'Presupuesto de obra', { pct: 10 }, { base: 'Honorario de diseño (AP y S)', source: 'D2090', ref: '3.2.1' }),
    p('A-CC', 'OTROS', 'Control de costos — administración delegada', { pct: 0.9 }, { base: 'Costo real de la construcción', source: 'D2090', ref: '4.2.1', variants: [{ key: 'PU', label: 'Por precios unitarios', f: { pct: 0.45 } }] }),
    p('A-PROG', 'OTROS', 'Control de programación de obra', { pct: 0.8 }, { base: 'Costo real de la construcción', source: 'D2090', ref: '5.2.2' }),
  ],
  sources: [{ key: 'D2090', label: 'Decreto 2090 de 1989 — reglamento de honorarios para trabajos de arquitectura', url: 'https://normas.cra.gov.co/gestor/docs/decreto_2090_1989.htm', note: 'Fija porcentajes mínimos sobre el costo base de la construcción (CBT).' }],
  disclaimer: 'Porcentajes del Decreto 2090 de 1989 aplicados de forma simplificada. Revisa el decreto para tramos de área, construcción en serie y formas de pago por entregas.',
};

export const HEALTH_TABLE: FeeTable = {
  key: 'HEALTH', profile: 'HEALTH', title: 'Consultas particulares de salud (mercado 2026)', profession: 'Salud', kind: 'MARKET',
  areas: [{ key: 'ESPECIALISTA', label: 'Médicos especialistas' }, { key: 'PSICOLOGIA', label: 'Psicología' }],
  items: [
    r('H-ESP', 'ESPECIALISTA', 'Consulta con especialista (promedio de todas las especialidades)', 210_000, 300_000, 'EMD'),
    r('H-PED', 'ESPECIALISTA', 'Pediatría — primera consulta', 175_000, 220_000, 'EMD'),
    r('H-DER', 'ESPECIALISTA', 'Dermatología — primera consulta', 222_500, 280_000, 'EMD'),
    r('H-GIN', 'ESPECIALISTA', 'Ginecología y obstetricia — primera consulta', 215_000, 280_000, 'EMD'),
    r('H-PSQ', 'ESPECIALISTA', 'Psiquiatría — primera consulta', 220_000, 270_000, 'EMD'),
    r('H-NEU', 'ESPECIALISTA', 'Neurología — primera consulta', 220_000, 300_000, 'EMD'),
    r('H-ORL', 'ESPECIALISTA', 'Otorrinolaringología — primera consulta', 200_000, 289_000, 'EMD'),
    r('H-MI', 'ESPECIALISTA', 'Medicina interna — primera consulta', 200_000, 300_000, 'EMD'),
    r('H-GAS', 'ESPECIALISTA', 'Gastroenterología — primera consulta', 200_000, 330_000, 'EMD'),
    r('H-URO', 'ESPECIALISTA', 'Urología — primera consulta', 220_000, 300_000, 'EMD'),
    r('H-ORT', 'ESPECIALISTA', 'Ortopedia y traumatología — primera consulta', 210_000, 320_000, 'EMD'),
    r('H-CAR', 'ESPECIALISTA', 'Cardiología — primera consulta', 247_500, 320_000, 'EMD'),
    r('H-END', 'ESPECIALISTA', 'Endocrinología — primera consulta', 250_000, 310_000, 'EMD'),
    r('H-TELE', 'ESPECIALISTA', 'Teleconsulta con especialista', 150_000, 350_000, 'EMD', { tags: 'virtual online' }),
    r('P-IND-JR', 'PSICOLOGIA', 'Psicoterapia individual — recién graduado', 50_000, 120_000, 'CMCP', { unit: 'sesión' }),
    r('P-IND', 'PSICOLOGIA', 'Psicoterapia individual — 3 a 7 años de experiencia', 100_000, 220_000, 'CMCP', { unit: 'sesión' }),
    r('P-IND-SR', 'PSICOLOGIA', 'Psicoterapia individual — 8 a 15 años y posgrado', 180_000, 350_000, 'CMCP', { unit: 'sesión' }),
    r('P-PAR', 'PSICOLOGIA', 'Terapia de pareja (60–90 min)', 140_000, 308_000, 'CMCP', { unit: 'sesión' }),
    r('P-FAM', 'PSICOLOGIA', 'Terapia familiar (60–90 min)', 150_000, 330_000, 'CMCP', { unit: 'sesión' }),
    r('P-GRU', 'PSICOLOGIA', 'Terapia de grupo (por persona)', 30_000, 130_000, 'CMCP', { unit: 'persona' }),
    r('P-VIR', 'PSICOLOGIA', 'Sesión virtual (plataformas)', 60_000, 150_000, 'CMCP', { unit: 'sesión' }),
    r('P-EVAL', 'PSICOLOGIA', 'Evaluación psicométrica con informe', 400_000, 1_500_000, 'CMCP'),
    r('P-FOR', 'PSICOLOGIA', 'Informe forense o de custodia', 500_000, 2_000_000, 'CMCP'),
    r('P-EMDR', 'PSICOLOGIA', 'Sesión EMDR', 180_000, 400_000, 'CMCP', { unit: 'sesión' }),
  ],
  sources: [
    { key: 'EMD', label: 'ElMejorDoc — ¿Cuánto cuesta una cita con un especialista en Colombia? (agosto 2026)', url: 'https://elmejordoc.com/blog/cuanto-cuesta-una-cita-con-un-especialista-en-colombia', note: 'Rango del 50 % central de precios publicados en Bogotá y Medellín, primera consulta presencial.' },
    { key: 'CMCP', label: 'cuantomecuesta.com — Psicólogo en Colombia (abril 2026)', url: 'https://cuantomecuesta.com/co/psicologo/' },
  ],
  disclaimer: MARKET_DISCLAIMER,
  notes: ['No encontramos una fuente confiable de precios particulares de medicina general u odontología: agrégalos como concepto propio.'],
};

export const BEAUTY_TABLE: FeeTable = {
  key: 'BEAUTY', profile: 'BEAUTY', title: 'Precios de peluquería, estética y spa (mercado 2026)', profession: 'Belleza y estética', kind: 'MARKET',
  areas: [{ key: 'CABELLO', label: 'Cabello' }, { key: 'UNAS', label: 'Uñas' }, { key: 'ROSTRO', label: 'Rostro y maquillaje' }, { key: 'CUERPO', label: 'Cuerpo y spa' }],
  items: [
    r('B-CORTE-M', 'CABELLO', 'Corte de cabello mujer', 30_000, 200_000, 'CMCB'),
    r('B-CORTE-H', 'CABELLO', 'Corte de cabello hombre', 20_000, 80_000, 'CMCB'),
    r('B-BARB', 'CABELLO', 'Barbería premium (corte y barba)', 60_000, 120_000, 'CMCB'),
    r('B-TINTE', 'CABELLO', 'Tinte de color completo', 80_000, 300_000, 'CMCB'),
    r('B-REFL', 'CABELLO', 'Reflejos o iluminaciones', 150_000, 600_000, 'CMCB'),
    r('B-BAL', 'CABELLO', 'Mechas o balayage', 200_000, 800_000, 'CMCB'),
    r('B-KER', 'CABELLO', 'Alisado o keratina', 200_000, 1_000_000, 'CMCB'),
    r('B-MANI', 'UNAS', 'Manicure básica', 20_000, 80_000, 'CMCB'),
    r('B-SEMI', 'UNAS', 'Manicure semipermanente', 50_000, 150_000, 'CMCB'),
    r('B-PEDI', 'UNAS', 'Pedicure', 30_000, 100_000, 'CMCB'),
    r('B-ACRI', 'UNAS', 'Uñas acrílicas o en gel', 80_000, 300_000, 'CMCB'),
    r('B-MICRO', 'ROSTRO', 'Microblading de cejas', 300_000, 1_500_000, 'CMCB'),
    r('B-PEST', 'ROSTRO', 'Pestañas postizas', 100_000, 500_000, 'CMCB'),
    r('B-MAQ', 'ROSTRO', 'Maquillaje social', 80_000, 300_000, 'CMCB'),
    r('B-MAQ-GR', 'ROSTRO', 'Maquillaje de grado', 150_000, 400_000, 'CMCB'),
    r('B-NOVIA', 'ROSTRO', 'Maquillaje de novia', 200_000, 1_500_000, 'CMCB'),
    r('B-LASER-P', 'CUERPO', 'Depilación láser zona pequeña (por sesión)', 300_000, 600_000, 'CMCB', { unit: 'sesión' }),
    r('B-LASER-G', 'CUERPO', 'Depilación láser zona grande (por sesión)', 800_000, 2_000_000, 'CMCB', { unit: 'sesión' }),
    r('B-MASAJE', 'CUERPO', 'Masaje relajante (60 min)', 80_000, 300_000, 'CMCB'),
    r('B-MASAJE2', 'CUERPO', 'Masaje en pareja', 200_000, 600_000, 'CMCB'),
    r('B-SPA', 'CUERPO', 'Día de spa completo', 300_000, 1_500_000, 'CMCB'),
  ],
  sources: [{ key: 'CMCB', label: 'cuantomecuesta.com — Peluquería y belleza en Colombia (abril 2026)', url: 'https://cuantomecuesta.com/co/peluqueria-belleza/' }],
  disclaimer: MARKET_DISCLAIMER,
};

export const TECH_TABLE: FeeTable = {
  key: 'TECH_REPAIR', profile: 'TECH_REPAIR', title: 'Reparación de celulares (mercado 2026)', profession: 'Técnicos en celulares', kind: 'MARKET',
  areas: [{ key: 'CELULAR', label: 'Celulares' }],
  items: [
    r('T-DIAG', 'CELULAR', 'Diagnóstico', 0, 30_000, 'GEST', { note: 'Muchos talleres lo dan gratis o lo descuentan de la reparación.' }),
    r('T-PANT-M', 'CELULAR', 'Cambio de pantalla — gama media', 120_000, 350_000, 'GEST', { tags: 'display táctil' }),
    r('T-PANT-A', 'CELULAR', 'Cambio de pantalla — gama alta', 300_000, 900_000, 'GEST', { tags: 'display iPhone Samsung' }),
    r('T-BAT', 'CELULAR', 'Cambio de batería', 60_000, 200_000, 'GEST'),
    r('T-PUERTO', 'CELULAR', 'Puerto de carga', 50_000, 150_000, 'GEST', { tags: 'pin de carga' }),
  ],
  sources: [{ key: 'GEST', label: 'Gestabiz — Reparación de celulares en Bogotá, guía 2026 (30 jun 2026)', url: 'https://gestabiz.com/blog/reparacion-celulares-bogota-colombia-2026', note: 'Incluye repuesto y mano de obra.' }],
  disclaimer: MARKET_DISCLAIMER,
  notes: ['Para software, cámaras o equipos mojados no encontramos rangos confiables: agrégalos como concepto propio.'],
};

export const HOME_TABLE: FeeTable = {
  key: 'HOME', profile: 'HOME', title: 'Instalaciones eléctricas en el hogar (mercado 2026)', profession: 'Electricistas y servicios del hogar', kind: 'MARKET',
  areas: [{ key: 'PUNTOS', label: 'Puntos eléctricos' }, { key: 'TABLEROS', label: 'Tableros y puesta a tierra' }, { key: 'JORNAL', label: 'Mano de obra por día' }],
  items: [
    r('E-TOMA', 'PUNTOS', 'Toma doble (solo mano de obra)', 35_000, 50_000, 'PRESU', { unit: 'punto', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [85_000, 120_000] } }] }),
    r('E-TOMA-T', 'PUNTOS', 'Toma doble con polo a tierra (mano de obra)', 40_000, 55_000, 'PRESU', { unit: 'punto', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [95_000, 130_000] } }] }),
    r('E-GFCI', 'PUNTOS', 'Toma GFCI baño o cocina (mano de obra)', 45_000, 65_000, 'PRESU', { unit: 'punto', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [120_000, 180_000] } }] }),
    r('E-LUZ', 'PUNTOS', 'Punto de iluminación con interruptor (mano de obra)', 40_000, 65_000, 'PRESU', { unit: 'punto', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [95_000, 150_000] } }] }),
    r('E-CONM', 'PUNTOS', 'Punto conmutable (mano de obra)', 60_000, 90_000, 'PRESU', { unit: 'punto', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [130_000, 200_000] } }] }),
    r('E-220', 'PUNTOS', 'Punto 220 V — aire o ducha eléctrica (mano de obra)', 65_000, 100_000, 'PRESU', { unit: 'punto', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [180_000, 280_000] } }] }),
    r('E-CABLE', 'PUNTOS', 'Cableado (por metro lineal, mano de obra)', 8_000, 14_000, 'PRESU', { unit: 'metro', variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [22_000, 38_000] } }] }),
    r('E-TAB6', 'TABLEROS', 'Tablero de 6 circuitos (mano de obra)', 80_000, 120_000, 'PRESU', { variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [350_000, 550_000] } }] }),
    r('E-TAB12', 'TABLEROS', 'Tablero de 12 circuitos (mano de obra)', 100_000, 150_000, 'PRESU', { variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [550_000, 900_000] } }] }),
    r('E-TAB24', 'TABLEROS', 'Tablero de 24 circuitos (mano de obra)', 150_000, 220_000, 'PRESU', { variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [950_000, 1_600_000] } }] }),
    r('E-TIERRA', 'TABLEROS', 'Puesta a tierra (varilla y cable, mano de obra)', 80_000, 130_000, 'PRESU', { variants: [{ key: 'MAT', label: 'Con materiales', f: { range: [200_000, 350_000] } }] }),
    r('E-RETIE', 'TABLEROS', 'Certificado RETIE', 200_000, 500_000, 'PRESU'),
    r('E-DIA-OF', 'JORNAL', 'Día de electricista oficial', 120_000, 180_000, 'PRESU', { unit: 'día' }),
    r('E-DIA-MA', 'JORNAL', 'Día de maestro electricista', 170_000, 220_000, 'PRESU', { unit: 'día' }),
  ],
  sources: [{ key: 'PRESU', label: 'Presucosto — Precio punto eléctrico Colombia 2026', url: 'https://presucosto.com/blog/precio-punto-electrico-colombia-2026', note: 'Varía ±15 % según la ciudad.' }],
  disclaimer: MARKET_DISCLAIMER,
  notes: ['Para plomería, pintura o cerrajería no encontramos rangos confiables: agrégalos como concepto propio o calcula tu tarifa por hora.'],
};

export const EDUCATION_TABLE: FeeTable = {
  key: 'EDUCATION', profile: 'EDUCATION', title: 'Clases particulares y tutorías (mercado 2026)', profession: 'Docentes y tutores', kind: 'MARKET',
  areas: [{ key: 'TUTORIAS', label: 'Tutorías por hora' }, { key: 'IDIOMAS', label: 'Idiomas' }, { key: 'MUSICA', label: 'Música y programación (mensual)' }, { key: 'PREP', label: 'Preparación de exámenes y tesis' }],
  items: [
    r('ED-EST', 'TUTORIAS', 'Clase particular — estudiante universitario', 20_000, 40_000, 'CMCE', { unit: 'hora' }),
    r('ED-LIC', 'TUTORIAS', 'Clase particular — licenciado', 30_000, 60_000, 'CMCE', { unit: 'hora' }),
    r('ED-MAG', 'TUTORIAS', 'Clase particular — docente con maestría', 50_000, 100_000, 'CMCE', { unit: 'hora' }),
    r('ED-PROF', 'TUTORIAS', 'Clase particular — profesor universitario', 80_000, 150_000, 'CMCE', { unit: 'hora' }),
    r('ED-UNI', 'TUTORIAS', 'Tutoría universitaria (cálculo, programación)', 50_000, 150_000, 'CMCE', { unit: 'hora' }),
    r('ED-ING', 'IDIOMAS', 'Inglés con docente nativo', 60_000, 180_000, 'CMCE', { unit: 'hora' }),
    r('ED-ING-C', 'IDIOMAS', 'Inglés con docente certificado (CELTA, TEFL, TESOL)', 80_000, 250_000, 'CMCE', { unit: 'hora' }),
    r('ED-PIANO', 'MUSICA', 'Piano principiante (8 clases al mes)', 400_000, 800_000, 'CMCE', { unit: 'mes' }),
    r('ED-GUIT', 'MUSICA', 'Guitarra principiante (8 clases al mes)', 300_000, 600_000, 'CMCE', { unit: 'mes' }),
    r('ED-VIOL', 'MUSICA', 'Violín avanzado (8 clases al mes)', 600_000, 1_500_000, 'CMCE', { unit: 'mes' }),
    r('ED-PROG-N', 'MUSICA', 'Programación para niños (Scratch o Python básico)', 300_000, 700_000, 'CMCE', { unit: 'mes' }),
    r('ED-PROG-A', 'MUSICA', 'Programación para adultos', 400_000, 1_000_000, 'CMCE', { unit: 'mes' }),
    r('ED-SABER', 'PREP', 'Preparación Saber 11 con tutor (24 a 36 horas)', 1_200_000, 4_300_000, 'CMCE', { tags: 'ICFES' }),
    r('ED-TESIS-H', 'PREP', 'Asesoría de tesis de maestría', 150_000, 400_000, 'CMCE', { unit: 'hora' }),
    r('ED-TESIS', 'PREP', 'Programa de acompañamiento de tesis (30 a 50 horas)', 5_000_000, 20_000_000, 'CMCE'),
  ],
  sources: [{ key: 'CMCE', label: 'cuantomecuesta.com — Clases particulares en Colombia (2026)', url: 'https://cuantomecuesta.com/co/clases-particulares/' }],
  disclaimer: MARKET_DISCLAIMER,
};
