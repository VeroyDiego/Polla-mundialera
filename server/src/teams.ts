/**
 * Diccionario de nombres de selecciones: inglés (como suele devolverlo
 * football-data.org / openfootball) -> español (como se muestra en la app).
 *
 * Se usa para emparejar partidos semilla (cargados en español) con los
 * fixtures que llegan de la fuente externa (en inglés), sin depender de
 * IDs de equipo propios de cada proveedor.
 *
 * No pretende cubrir las 211 federaciones de FIFA: cubre los 48 cupos
 * plausibles del Mundial 2026 más variantes comunes de nombre. Si un
 * equipo no está en el diccionario, se usa su nombre tal cual venga
 * (se registra en el log de sync para poder agregarlo).
 */
export const ENGLISH_TO_SPANISH_TEAM: Record<string, string> = {
  "south africa": "Sudáfrica",
  canada: "Canadá",
  brazil: "Brasil",
  japan: "Japón",
  germany: "Alemania",
  paraguay: "Paraguay",
  netherlands: "Países Bajos",
  holland: "Países Bajos",
  morocco: "Marruecos",
  "ivory coast": "Costa de Marfil",
  "côte d'ivoire": "Costa de Marfil",
  "cote d'ivoire": "Costa de Marfil",
  norway: "Noruega",
  france: "Francia",
  sweden: "Suecia",
  mexico: "México",
  ecuador: "Ecuador",
  england: "Inglaterra",
  "dr congo": "R.D. del Congo",
  "congo dr": "R.D. del Congo",
  "democratic republic of the congo": "R.D. del Congo",
  belgium: "Bélgica",
  senegal: "Senegal",
  "united states": "Estados Unidos",
  usa: "Estados Unidos",
  "bosnia and herzegovina": "Bosnia y Herzegovina",
  argentina: "Argentina",
  uruguay: "Uruguay",
  colombia: "Colombia",
  chile: "Chile",
  peru: "Perú",
  bolivia: "Bolivia",
  venezuela: "Venezuela",
  spain: "España",
  portugal: "Portugal",
  italy: "Italia",
  croatia: "Croacia",
  switzerland: "Suiza",
  austria: "Austria",
  poland: "Polonia",
  ukraine: "Ucrania",
  scotland: "Escocia",
  wales: "Gales",
  "republic of ireland": "Irlanda",
  ireland: "Irlanda",
  denmark: "Dinamarca",
  turkey: "Turquía",
  türkiye: "Turquía",
  serbia: "Serbia",
  slovenia: "Eslovenia",
  slovakia: "Eslovaquia",
  "czech republic": "República Checa",
  czechia: "República Checa",
  hungary: "Hungría",
  romania: "Rumania",
  greece: "Grecia",
  algeria: "Argelia",
  tunisia: "Túnez",
  egypt: "Egipto",
  nigeria: "Nigeria",
  ghana: "Ghana",
  cameroon: "Camerún",
  "cape verde": "Cabo Verde",
  jordan: "Jordania",
  "saudi arabia": "Arabia Saudita",
  iran: "Irán",
  "ir iran": "Irán",
  iraq: "Irak",
  qatar: "Catar",
  uzbekistan: "Uzbekistán",
  "korea republic": "Corea del Sur",
  "south korea": "Corea del Sur",
  australia: "Australia",
  "new zealand": "Nueva Zelanda",
  panama: "Panamá",
  "costa rica": "Costa Rica",
  honduras: "Honduras",
  jamaica: "Jamaica",
  curacao: "Curazao",
  "curaçao": "Curazao",
  haiti: "Haití",
  suriname: "Surinam",
  "trinidad and tobago": "Trinidad y Tobago",
  guatemala: "Guatemala"
};

/** Minúsculas y sin tildes/diacríticos, para comparar sin importar el idioma de origen. */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Traduce un nombre en inglés (si está en el diccionario) a español; si no, lo deja igual. */
export function translateToSpanish(englishName: string): string {
  const key = normalizeTeamName(englishName);
  return ENGLISH_TO_SPANISH_TEAM[key] ?? englishName;
}

/** Clave estable para comparar dos equipos sin importar el idioma/formato de origen. */
export function teamMatchKey(name: string): string {
  return normalizeTeamName(translateToSpanish(name));
}
