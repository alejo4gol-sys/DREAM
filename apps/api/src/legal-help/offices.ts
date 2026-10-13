/**
 * Directorio de entidades para «dónde acudir».
 * - Canales nacionales: teléfonos y páginas oficiales (siempre se muestran).
 * - Sedes locales: direcciones públicas encontradas en páginas oficiales o en directorios públicos.
 *   `verify: true` = la fuente no es oficial o es anterior a 2023: se muestra con la marca «por confirmar».
 * - Si no hay sede registrada para el municipio, se ofrece un enlace de búsqueda en Google Maps.
 * Revisado: octubre de 2026. Las direcciones y horarios cambian: la app siempre pide verificarlos antes de ir.
 */

export type EntityKey =
  | 'FISCALIA' | 'POLICIA' | 'INSPECCION_POLICIA' | 'PERSONERIA' | 'DEFENSORIA' | 'CASA_JUSTICIA' | 'COMISARIA' | 'ICBF'
  | 'MINTRABAJO' | 'REPARTO' | 'PROCURADURIA' | 'CONSULTORIO' | 'NOTARIA' | 'SUPERSALUD' | 'SIC' | 'SUPERSERVICIOS'
  | 'SUPERFINANCIERA' | 'COLPENSIONES';

export interface Office { name: string; address: string; phone?: string; hours?: string; source: string; sourceUrl?: string; verify?: boolean; note?: string }
interface Link { label: string; url: string }
interface Entity {
  label: string; mapsQuery?: string; phones?: { label: string; phone: string }[]; online?: Link[]; directory?: Link;
  /** Sedes locales por municipio: clave "departamento|municipio" normalizada. */
  local?: Record<string, Office[]>;
}

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const k = (dep: string, city: string) => `${norm(dep)}|${norm(city)}`;
const VALLE = 'Valle del Cauca';
const BOG = k('Bogotá D.C.', 'Bogotá D.C.');

export const ENTITIES: Record<EntityKey, Entity> = {
  FISCALIA: {
    label: 'Fiscalía General de la Nación', mapsQuery: 'Fiscalía URI',
    phones: [{ label: 'Línea 122 (gratuita)', phone: '122' }, { label: 'Línea nacional', phone: '018000919748' }],
    online: [{ label: 'Denunciar en línea', url: 'https://sicecon.fiscalia.gov.co/denuncia/ingresoPrincipal' }],
    directory: { label: 'Dónde y cómo denunciar', url: 'https://www.fiscalia.gov.co/colombia/servicios-de-informacion-al-ciudadano/donde-y-como-denunciar/' },
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'Fiscalía — URI Cali', address: 'Calle 7 No. 6-62, Cali', phone: '6023989980', source: 'Fiscalía (publicación anterior a 2023)', verify: true }],
      [k(VALLE, 'Buga')]: [{ name: 'Fiscalía — Seccional La Casona', address: 'Carrera 15 No. 7-16, Buga', phone: '6023989980', source: 'Fiscalía', verify: true, note: 'En noviembre de 2025 se inauguró una nueva sede en Buga: confirma la dirección antes de ir.' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Fiscalía — Palmira', address: 'Calle 31 No. 30-46, Palmira', source: 'Alcaldía de Palmira (2023)' }],
      [k(VALLE, 'Tuluá')]: [{ name: 'Fiscalía — Tuluá', address: 'Carrera 26 No. 26-15, Tuluá', source: 'Fiscalía (documento anterior a 2023)', verify: true, note: 'Podría haberse trasladado a la Carrera 25 No. 27-36.' }],
      [k(VALLE, 'Cartago')]: [{ name: 'Fiscalía — Cartago', address: 'Carrera 5 No. 12A-23, Cartago', source: 'Directorio público', verify: true }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'Fiscalía — CAPIV Buenaventura', address: 'Calle 7 No. 3-46, Buenaventura', source: 'Directorio público', verify: true }],
      [k(VALLE, 'Jamundí')]: [{ name: 'Fiscalía — URI Jamundí', address: 'Carrera 9A No. 19-37, Jamundí', source: 'Mapa colaborativo', verify: true }],
      [BOG]: [{ name: 'Fiscalía — URI Paloquemao', address: 'Avenida Calle 19 No. 29-75, Bogotá', phone: '6012971177', source: 'Fiscalía' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Fiscalía — Búnker de la Fiscalía', address: 'Carrera 64C No. 67-300, Medellín', source: 'Fiscalía' }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'Fiscalía — Sala de Atención al Usuario', address: 'Calle 41 No. 41-69, piso 4, Barranquilla', phone: '6053702260', source: 'Fiscalía (sin fecha)', verify: true }],
    },
  },
  POLICIA: {
    label: 'Policía Nacional', mapsQuery: 'Estación de Policía',
    phones: [{ label: 'Emergencias', phone: '123' }],
    online: [{ label: 'A Denunciar (algunos delitos en línea)', url: 'https://adenunciar.policia.gov.co/Adenunciar/' }],
    directory: { label: 'Salas de denuncia', url: 'https://adenunciar.policia.gov.co/adenunciar/frm_salas.aspx' },
  },
  INSPECCION_POLICIA: { label: 'Inspección de Policía', mapsQuery: 'Inspección de Policía' },
  PERSONERIA: {
    label: 'Personería Municipal', mapsQuery: 'Personería Municipal',
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'Personería de Cali', address: 'CAM, Torre Alcaldía piso 13, Avenida 2 Norte No. 10-70, Cali', phone: '6026617999', hours: 'Lunes a viernes 8:00–12:00 y 1:00–5:00 p. m.', source: 'personeriacali.gov.co (2025)', sourceUrl: 'https://www.personeriacali.gov.co/' }],
      [k(VALLE, 'Buga')]: [{ name: 'Personería de Buga', address: 'Calle 7 No. 12-45, piso 1, Buga', phone: '6022017004', source: 'Directorio Alcaldía de Buga (2025)' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Personería de Palmira', address: 'Carrera 24 No. 21-20, Palmira', phone: '6022759010', source: 'Personería de Palmira' }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'Personería de Buenaventura', address: 'Calle 2, Edificio CAD piso 10, Buenaventura', source: 'Directorio público', verify: true }],
      [BOG]: [{ name: 'Personería de Bogotá — Sede principal', address: 'Carrera 7 No. 21-24, Bogotá', phone: '6013820450', hours: 'Línea 143', source: 'personeriabogota.gov.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Personería de Medellín', address: 'Carrera 53A No. 42-101, Medellín', phone: '6043849999', source: 'personeriamedellin.gov.co' }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'Personería de Barranquilla', address: 'Carrera 45 No. 38-01, Barranquilla', phone: '6053133730', source: 'personeriabarranquilla.gov.co' }],
    },
  },
  DEFENSORIA: {
    label: 'Defensoría del Pueblo', mapsQuery: 'Defensoría del Pueblo regional',
    phones: [{ label: 'Línea nacional gratuita', phone: '018000914814' }],
    online: [{ label: 'Formulario de peticiones', url: 'https://www.defensoria.gov.co/formulario-unico-de-peticiones' }],
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'Defensoría del Pueblo — Regional Valle (punto temporal)', address: 'Carrera 27 No. 105-100, Casa de los Derechos de Aguablanca, Cali', phone: '3108539454', source: 'defensoria.gov.co/valle', sourceUrl: 'https://www.defensoria.gov.co/valle', note: 'Sede temporal hasta el 31 de octubre de 2026.' }],
      [BOG]: [{ name: 'Defensoría del Pueblo — Sede nacional', address: 'Carrera 9 No. 16-21, Bogotá', phone: '6013147300', source: 'Directorio público', verify: true }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Defensoría del Pueblo — Regional Antioquia', address: 'Carrera 47 No. 56-57, Medellín', source: 'defensoria.gov.co/antioquia', sourceUrl: 'https://www.defensoria.gov.co/antioquia' }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'Defensoría del Pueblo — Regional Atlántico', address: 'Calle 68B No. 50-119, Barranquilla', source: 'defensoria.gov.co/atlantico', sourceUrl: 'https://www.defensoria.gov.co/atlantico' }],
      // Sedes regionales: atienden a todo el departamento.
      [k(VALLE, '*')]: [{ name: 'Defensoría del Pueblo — Regional Valle (en Cali, punto temporal)', address: 'Carrera 27 No. 105-100, Casa de los Derechos de Aguablanca, Cali', phone: '3108539454', source: 'defensoria.gov.co/valle', sourceUrl: 'https://www.defensoria.gov.co/valle', note: 'Es la sede regional del departamento. Sede temporal hasta el 31 de octubre de 2026.' }],
      [k('Antioquia', '*')]: [{ name: 'Defensoría del Pueblo — Regional Antioquia (en Medellín)', address: 'Carrera 47 No. 56-57, Medellín', source: 'defensoria.gov.co/antioquia', sourceUrl: 'https://www.defensoria.gov.co/antioquia', note: 'Es la sede regional del departamento.' }],
      [k('Atlántico', '*')]: [{ name: 'Defensoría del Pueblo — Regional Atlántico (en Barranquilla)', address: 'Calle 68B No. 50-119, Barranquilla', source: 'defensoria.gov.co/atlantico', sourceUrl: 'https://www.defensoria.gov.co/atlantico', note: 'Es la sede regional del departamento.' }],
    },
  },
  CASA_JUSTICIA: {
    label: 'Casa de Justicia', mapsQuery: 'Casa de Justicia',
    phones: [{ label: 'Minjusticia (línea gratuita)', phone: '018000911170' }],
    directory: { label: 'Programa Casas de Justicia', url: 'https://minjusticia.gov.co/programas/casas-de-justicia' },
    local: {
      [k(VALLE, 'Cali')]: [
        { name: 'Casa de Justicia Aguablanca', address: 'Calle 73 No. 26R-00, Cali', phone: '6024229746', source: 'Alcaldía de Cali' },
        { name: 'Casa de Justicia Alfonso López', address: 'Calle 73 No. 7G-28, Cali', source: 'Alcaldía de Cali' },
        { name: 'Casa de Justicia Siloé', address: 'Carrera 52 No. 2-00, Cali', phone: '6025521827', source: 'Alcaldía de Cali' }],
      [k(VALLE, 'Buga')]: [{ name: 'Casa de Justicia de Buga', address: 'Calle 30 No. 13-01, Buga', phone: '6022366780', source: 'Alcaldía de Buga' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Casa de Justicia Caimitos', address: 'Calle 57 No. 44-02, Palmira', source: 'Alcaldía de Palmira' }],
      [k(VALLE, 'Tuluá')]: [{ name: 'Casa de Justicia de Tuluá', address: 'Carrera 10 No. 25-50, barrio Maranduá, Tuluá', phone: '6022339322', source: 'Alcaldía de Tuluá' }],
      [k(VALLE, 'Cartago')]: [{ name: 'Casa de Justicia de Cartago', address: 'Carrera 1 con Calle 37, Cartago', phone: '6022101411', source: 'Alcaldía de Cartago' }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'Casa de Justicia de Buenaventura', address: 'Calle 4A Sur con Carrera 73B, Buenaventura', source: 'Directorio público', verify: true }],
      [BOG]: [
        { name: 'Casa de Justicia Barrios Unidos', address: 'Calle 68 No. 53-34, Bogotá', source: 'bogota.gov.co' },
        { name: 'Casa de Justicia Kennedy', address: 'Avenida Boyacá No. 36-57 Sur, Bogotá', source: 'bogota.gov.co' },
        { name: 'Casa de Justicia Chapinero', address: 'Calle 63 No. 9-76, Bogotá', phone: '6013779595', source: 'bogota.gov.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Casa de Justicia El Bosque', address: 'Carrera 52 No. 71-84, Medellín', source: 'Alcaldía de Medellín' }],
      [k('Atlántico', 'Barranquilla')]: [
        { name: 'Casa de Justicia Simón Bolívar', address: 'Carrera 5 No. 19-07, Barranquilla', source: 'Alcaldía de Barranquilla' },
        { name: 'Unidad de Convivencia y Justicia', address: 'Calle 56 No. 11-102, Barranquilla', source: 'Alcaldía de Barranquilla' }],
    },
  },
  COMISARIA: {
    label: 'Comisaría de Familia', mapsQuery: 'Comisaría de Familia',
    phones: [{ label: 'Violencia contra la mujer (Línea 155)', phone: '155' }, { label: 'Emergencias', phone: '123' }],
    local: {
      [k(VALLE, 'Buga')]: [{ name: 'Comisaría de Familia de Buga', address: 'Calle 24 No. 13-04, Buga', phone: '6022366340', source: 'Alcaldía de Buga' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Comisaría de Familia Central (24 horas)', address: 'Calle 23 No. 28A-15, Palmira', source: 'Alcaldía de Palmira' }],
      [k(VALLE, 'Tuluá')]: [{ name: 'Comisaría de Familia — Casa de Justicia', address: 'Carrera 10 No. 25-50, barrio Maranduá, Tuluá', phone: '6022339322', source: 'Alcaldía de Tuluá' }],
      [k(VALLE, 'Cartago')]: [{ name: 'Comisaría de Familia 1', address: 'Carrera 2 Norte No. 12-35, Cartago', source: 'Alcaldía de Cartago' }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'Comisaría de Familia', address: 'Carrera 73B con Calle 3, Buenaventura', source: 'Directorio público', verify: true }],
      [BOG]: [{ name: 'Comisarías de Familia de Bogotá', address: 'Hay comisarías en todas las localidades', phone: '195', hours: 'Línea 195', source: 'Secretaría de Integración Social' }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'Comisarías de Familia — Unidad de Convivencia y Justicia', address: 'Calle 56 No. 11-102, Barranquilla', source: 'Alcaldía de Barranquilla' }],
    },
  },
  ICBF: {
    label: 'ICBF — Bienestar Familiar', mapsQuery: 'ICBF Centro Zonal',
    phones: [{ label: 'Línea 141 (niños en riesgo)', phone: '141' }, { label: 'Línea gratuita', phone: '018000918080' }],
    online: [{ label: 'Peticiones y denuncias', url: 'https://www.icbf.gov.co/formulario-de-solicitudes-pqrds-peticiones-quejas-reclamos-denuncias-y-sugerencias' }],
    directory: { label: 'Puntos de atención', url: 'https://www.icbf.gov.co/puntos-atencion' },
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'ICBF Centro Zonal Centro', address: 'Avenida 1 Norte No. 7N-41, Cali', source: 'icbf.gov.co' }, { name: 'ICBF Regional Valle', address: 'Avenida 2 Norte No. 33-45, Cali', source: 'icbf.gov.co' }],
      [k(VALLE, 'Buga')]: [{ name: 'ICBF Centro Zonal Buga', address: 'Carrera 8, Carretera Central vía Chambimbal, Buga', source: 'icbf.gov.co' }],
      [k(VALLE, 'Palmira')]: [{ name: 'ICBF Centro Zonal Palmira', address: 'Carrera 31 No. 23-52, Palmira', source: 'icbf.gov.co' }],
      [k(VALLE, 'Tuluá')]: [{ name: 'ICBF Centro Zonal Tuluá', address: 'Carrera 30 No. 27-20, piso 3, Tuluá', source: 'icbf.gov.co' }],
      [k(VALLE, 'Cartago')]: [{ name: 'ICBF Centro Zonal Cartago', address: 'Carrera 6 No. 9-49, Cartago', source: 'icbf.gov.co' }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'ICBF Centro Zonal Buenaventura', address: 'Avenida Simón Bolívar, km 9, Buenaventura', source: 'icbf.gov.co' }],
      [k(VALLE, 'Jamundí')]: [{ name: 'ICBF Centro Zonal Jamundí', address: 'Carrera 14 No. 16-67, Jamundí', source: 'icbf.gov.co' }],
      [BOG]: [{ name: 'ICBF Regional Bogotá', address: 'Carrera 50 No. 26-51, Bogotá', source: 'icbf.gov.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'ICBF Regional Antioquia', address: 'Calle 45 No. 79-141, Medellín', source: 'icbf.gov.co' }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'ICBF Regional Atlántico', address: 'Carrera 46 No. 61-15, Barranquilla', source: 'icbf.gov.co' }],
    },
  },
  MINTRABAJO: {
    label: 'Ministerio del Trabajo — Inspección', mapsQuery: 'Ministerio del Trabajo inspección de trabajo',
    phones: [{ label: 'Conmutador Bogotá', phone: '6013813000' }, { label: 'Línea 120', phone: '120' }],
    directory: { label: 'Direcciones territoriales', url: 'https://www.mintrabajo.gov.co/el-ministerio/directorio/direcciones-territoriales' },
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'Mintrabajo — Dirección Territorial Valle', address: 'Avenida de las Américas No. 23A-02, Cali', source: 'Directorio público', verify: true }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'Mintrabajo — Buenaventura', address: 'Calle 3A No. 2A-35, oficina 106, Buenaventura', source: 'Directorio público', verify: true }],
      [BOG]: [{ name: 'Ministerio del Trabajo — Sede principal', address: 'Carrera 7 No. 32-63, Bogotá', phone: '6013813000', source: 'mintrabajo.gov.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Mintrabajo — Dirección Territorial Antioquia', address: 'Carrera 56A No. 51-81, Medellín', source: 'Directorio público', verify: true }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'Mintrabajo — Dirección Territorial Atlántico', address: 'Carrera 49 No. 72-46, Barranquilla', source: 'Directorio público (2019)', verify: true }],
    },
  },
  REPARTO: {
    label: 'Rama Judicial — oficina de reparto', mapsQuery: 'Juzgado',
    online: [{ label: 'Tutela en línea', url: 'https://procesojudicial.ramajudicial.gov.co/TutelaEnLinea' }, { label: 'Demanda en línea', url: 'https://procesojudicial.ramajudicial.gov.co/demandaenlinea' }],
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'Oficina Judicial de Cali (reparto)', address: 'Carrera 10 No. 12-15, Palacio de Justicia piso 1, Cali', phone: '6028986868', source: 'ramajudicial.gov.co' }],
      [k(VALLE, 'Buga')]: [{ name: 'Oficina de Apoyo Judicial de Buga (reparto)', address: 'Calle 8 No. 14-59, Buga', phone: '6028986870', source: 'ramajudicial.gov.co' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Palacio de Justicia de Palmira', address: 'Carrera 29 No. 22-43, Palmira', source: 'ramajudicial.gov.co', verify: true, note: 'Pregunta en la entrada por la oficina de reparto.' }],
      [k(VALLE, 'Tuluá')]: [{ name: 'Palacio de Justicia de Tuluá', address: 'Calle 26 No. 27-00, Tuluá', source: 'ramajudicial.gov.co' }],
      [k(VALLE, 'Cartago')]: [{ name: 'Oficina de Servicios Judiciales de Cartago', address: 'Calle 11 No. 5-67, Cartago', source: 'ramajudicial.gov.co' }],
      [k(VALLE, 'Buenaventura')]: [{ name: 'Oficina de Apoyo Judicial de Buenaventura', address: 'Calle 3 No. 2A-35, Buenaventura', source: 'ramajudicial.gov.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Oficina Judicial de Medellín (reparto)', address: 'Carrera 52 No. 42-73, piso 2, Medellín', phone: '6042328525', source: 'ramajudicial.gov.co' }],
    },
  },
  PROCURADURIA: {
    label: 'Procuraduría General de la Nación', mapsQuery: 'Procuraduría',
    phones: [{ label: 'Línea gratuita', phone: '018000940808' }],
    online: [{ label: 'Trámites en línea', url: 'https://sedeelectronica.procuraduria.gov.co/Tr%C3%A1mites/' }],
    directory: { label: 'Sedes regionales y provinciales', url: 'https://www.procuraduria.gov.co/procuraduria/Pages/sedes-procuradurias-regionales-provinciales.aspx' },
    local: {
      [k(VALLE, 'Cali')]: [{ name: 'Procuraduría — Judiciales Administrativas (conciliación)', address: 'Calle 11 No. 5-54, Edificio Bancolombia, oficinas 302-311, Cali', phone: '6023908383', source: 'Procuraduría (2022)', verify: true }],
      [k(VALLE, 'Buga')]: [{ name: 'Procuraduría Provincial de Buga', address: 'Carrera 16 No. 6-51, Buga', source: 'procuraduria.gov.co' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Procuraduría Provincial de Cali (atiende Palmira)', address: 'Carrera 9 No. 8-56, Cali', source: 'procuraduria.gov.co' }],
      [BOG]: [{ name: 'Procuraduría General — Sede central', address: 'Carrera 5 No. 15-80, Bogotá', phone: '6015878750', source: 'procuraduria.gov.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Procuraduría Regional de Antioquia', address: 'Carrera 56A No. 49A-30, piso 3, Medellín', source: 'procuraduria.gov.co' }],
      [k('Atlántico', 'Barranquilla')]: [{ name: 'Procuraduría Regional del Atlántico', address: 'Calle 40 No. 44-39, Barranquilla', source: 'procuraduria.gov.co' }],
    },
  },
  CONSULTORIO: {
    label: 'Consultorio jurídico universitario (gratis)', mapsQuery: 'Consultorio jurídico universidad',
    local: {
      [k(VALLE, 'Cali')]: [
        { name: 'Consultorio Jurídico Universidad Santiago de Cali', address: 'Carrera 8 No. 8-17, Cali', phone: '6025183000', source: 'usc.edu.co' },
        { name: 'Consultorio Jurídico Universidad Icesi', address: 'Carrera 9 No. 9-49, piso 2, Cali', source: 'icesi.edu.co' }],
      [k(VALLE, 'Buga')]: [{ name: 'Consultorio Jurídico UCEVA — sede Buga', address: 'Carrera 8 No. 6-24, Buga', source: 'uceva.edu.co' }],
      [k(VALLE, 'Palmira')]: [{ name: 'Consultorio Jurídico USC — Palmira', address: 'Carrera 29 No. 38-47, Palmira', source: 'usc.edu.co' }],
      [k(VALLE, 'Tuluá')]: [{ name: 'Consultorio Jurídico UCEVA', address: 'Carrera 26 No. 30-40, Tuluá', source: 'uceva.edu.co' }],
      [k(VALLE, 'Cartago')]: [{ name: 'Consultorio Jurídico Universidad Cooperativa', address: 'Carrera 4 No. 13-63, Cartago', source: 'ucc.edu.co' }],
      [BOG]: [
        { name: 'Consultorio Jurídico Universidad del Rosario', address: 'Carrera 5 No. 15-37, Bogotá', source: 'urosario.edu.co' },
        { name: 'Consultorio Jurídico Universidad Javeriana', address: 'Calle 34 No. 15-61, Bogotá', source: 'javeriana.edu.co' },
        { name: 'Consultorio Jurídico Universidad de los Andes', address: 'Carrera 4 No. 16-51, Bogotá', source: 'uniandes.edu.co' }],
      [k('Antioquia', 'Medellín')]: [{ name: 'Consultorio Jurídico UPB', address: 'Circular 1 No. 73-76, Medellín', source: 'upb.edu.co' }],
      [k('Atlántico', 'Barranquilla')]: [
        { name: 'Consultorio Jurídico Universidad del Norte', address: 'Calle 74 No. 58-79, Barranquilla', phone: '6053509258', source: 'uninorte.edu.co' },
        { name: 'Consultorio Jurídico Universidad del Atlántico', address: 'Carrera 43 No. 50-53, Barranquilla', source: 'uniatlantico.edu.co' }],
    },
  },
  NOTARIA: { label: 'Notaría', mapsQuery: 'Notaría' },
  SUPERSALUD: {
    label: 'Superintendencia Nacional de Salud',
    phones: [{ label: 'Línea gratuita', phone: '018000513700' }],
    online: [{ label: 'Poner una queja (PQRD)', url: 'https://superargo.supersalud.gov.co/2/formularioWeb/pqrd.php' }],
  },
  SIC: {
    label: 'Superintendencia de Industria y Comercio',
    phones: [{ label: 'Línea gratuita', phone: '018000910165' }],
    online: [{ label: 'SIC Facilita (arreglo con la empresa)', url: 'https://sicfacilita.sic.gov.co/SICFacilita/index.xhtml' }, { label: 'Quejas y reclamos', url: 'https://servicioslinea.sic.gov.co/servilinea/pqrsf/' }],
  },
  SUPERSERVICIOS: {
    label: 'Superintendencia de Servicios Públicos',
    phones: [{ label: 'Línea gratuita', phone: '018000910305' }],
    online: [{ label: 'Te Resuelvo', url: 'https://teresuelvo.superservicios.gov.co/' }],
  },
  SUPERFINANCIERA: {
    label: 'Superintendencia Financiera',
    phones: [{ label: 'Línea gratuita', phone: '018000120100' }],
    online: [{ label: 'Quejas en línea', url: 'https://www.superfinanciera.gov.co/10110761' }],
  },
  COLPENSIONES: {
    label: 'Colpensiones', mapsQuery: 'Punto de atención Colpensiones',
    phones: [{ label: 'Línea gratuita', phone: '018000410909' }],
    online: [{ label: 'Sede electrónica', url: 'https://sede.colpensiones.gov.co/' }],
  },
};

/** Detecta qué entidades corresponden a los textos de «dónde» de una ruta. */
const RULES: [RegExp, EntityKey][] = [
  [/fiscal[ií]a|atenci[oó]n a v[ií]ctimas|caivas/i, 'FISCALIA'],
  [/inspecci[oó]n de polic[ií]a/i, 'INSPECCION_POLICIA'],
  [/^polic[ií]a|a denunciar/i, 'POLICIA'],
  [/personer[ií]a/i, 'PERSONERIA'],
  [/defensor[ií]a/i, 'DEFENSORIA'],
  [/casas? de justicia|conciliador(es)? en equidad/i, 'CASA_JUSTICIA'],
  [/comisar[ií]a/i, 'COMISARIA'],
  [/icbf/i, 'ICBF'],
  [/inspecci[oó]n del trabajo/i, 'MINTRABAJO'],
  [/juzgado|juez|rama judicial/i, 'REPARTO'],
  [/procuradur[ií]a/i, 'PROCURADURIA'],
  [/consultorio/i, 'CONSULTORIO'],
  [/notar[ií]a/i, 'NOTARIA'],
  [/supersalud|superintendencia de salud/i, 'SUPERSALUD'],
  [/\bsic\b|industria y comercio/i, 'SIC'],
  [/superservicios/i, 'SUPERSERVICIOS'],
  [/superintendencia financiera/i, 'SUPERFINANCIERA'],
  [/colpensiones/i, 'COLPENSIONES'],
];
export function entitiesFor(where: string[]): EntityKey[] {
  const out: EntityKey[] = [];
  for (const w of where) for (const [re, key] of RULES) if (re.test(w) && !out.includes(key)) out.push(key);
  return out;
}

export interface PlaceCard {
  entity: EntityKey; label: string; offices: (Office & { maps: string })[]; searchMaps?: string;
  phones: { label: string; phone: string }[]; online: Link[]; directory?: Link;
}
const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** Une la entidad con el municipio de la persona: sedes conocidas, canales nacionales y búsqueda en el mapa. */
export function placeFor(entity: EntityKey, department?: string, city?: string): PlaceCard {
  const e = ENTITIES[entity];
  const own = department && city ? e.local?.[k(department, city)] : undefined;
  const regional = !own && department ? e.local?.[k(department, '*')] : undefined;
  const offices = own ?? regional ?? [];
  const where = city && department ? (norm(city) === norm(department) ? city : `${city}, ${department}`) : '';
  return {
    entity, label: e.label,
    offices: offices.map((o) => ({ ...o, maps: maps(`${o.address}, Colombia`) })),
    searchMaps: e.mapsQuery && where && !regional ? maps(`${e.mapsQuery} ${where}`) : undefined,
    phones: e.phones ?? [], online: e.online ?? [], directory: e.directory,
  };
}
