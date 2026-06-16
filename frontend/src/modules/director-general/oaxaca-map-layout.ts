import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';

type DelegationCoords = Record<string, LatLngTuple>;
type RegionCoords = Record<string, LatLngTuple>;

const EXACT_DELEGATION_COORDS: DelegationCoords = {
  TLACOLULA: [16.9314623, -96.4611075],
  MITLA: [16.9675629, -96.3182467],
  'EL RETIRO': [17.0304149, -96.6307598],
  'IXTLAN DE JUAREZ': [17.476844, -96.3460036],
  ETLA: [17.197111, -96.7962866],
  'MIAHUATLAN DE P.D.': [16.3610815, -96.5850579],
  ZAACHILA: [16.9529021, -96.7839466],
  OCOTLAN: [16.784699, -96.6681765],
  'EJUTLA DE CRESPO': [16.5976679, -96.6608337],
  ZIMATLAN: [16.8727536, -96.8013464],
  'SOLA DE VEGA': [16.5716082, -97.1035414],
  HUATULCO: [15.8220916, -96.2059859],
  'PUERTO ESCONDIDO': [15.8693331, -97.0726428],
  POCHUTLA: [15.7914326, -96.4300667],
  'SANTOS REYES NOPALA': [16.0821395, -97.1791905],
  'PINOTEPA NACIONAL': [16.2961977, -98.1602324],
  JUQUILA: [16.1799827, -97.3303513],
  'RIO GRANDE': [16.0114184, -97.4346709],
  JAMILTEPEC: [16.2247631, -97.7807521],
  CACAHUATEPEC: [16.655554, -98.1934795],
  'MATIAS ROMERO': [17.1324525, -94.8785788],
  TAPANATEPEC: [16.3037258, -94.2852336],
  'MA. LOMBARDO': [17.4468344, -95.4283619],
  'MARIA LOMBARDO': [17.4468344, -95.4283619],
  'SAN JUAN GUICHICOVI': [17.1049808, -95.2254143],
  'SALINA CRUZ': [16.1977788, -95.2131936],
  'CIUDAD IXTEPEC': [16.6165531, -95.0784727],
  'CD IXTEPEC': [16.6165531, -95.0784727],
  JUCHITAN: [16.413329, -94.9118795],
  TEHUANTEPEC: [16.1889599, -95.3960273],
  'HUAJUAPAN DE LEON': [17.808846, -97.7780564],
  NOCHIXTLAN: [17.4517598, -97.1843544],
  TAMAZULAPAN: [17.6948288, -97.5780665],
  TLAXIACO: [17.269444, -97.679167],
  'S.P. Y S.P. TEPOSCOLULA': [17.4936148, -97.4712169],
  TEPOSCOLULA: [17.4936148, -97.4712169],
  'PUTLA DE GRO.': [16.7867827, -97.7798491],
  PUTLA: [16.7867827, -97.7798491],
  JUXTLAHUACA: [17.208558, -98.0383524],
  TUXTEPEC: [18.0874632, -96.1227767],
  TEMASCAL: [18.2419655, -96.4023187],
  COSOLAPA: [18.5805064, -96.652796],
  'VALLE NACIONAL': [17.774722, -96.301667],
  'ACATLAN DE PEREZ FIGUEROA': [18.5375, -96.605],
  'LOMA BONITA': [18.107778, -95.879722],
  'JALAPA DE DIAZ': [18.071944, -96.535833],
  'TEOTITLAN DE FLORES MAGON': [18.131389, -97.073611],
  TEOTITLAN: [18.131389, -97.073611],
  CUICATLAN: [17.803611, -96.959167],
  'HUAUTLA DE JIMENEZ': [18.131944, -96.840833],
  HUAUTLA: [18.131944, -96.840833],
  'JEFE OPERATIVO': [17.0575032, -96.7096251],
  COORDINACION: [17.0575032, -96.7096251],
};

const REGION_CENTROIDS: RegionCoords = {
  CENTRO: [17.0732, -96.7266],
  'REGION COSTA ZONA ORIENTE': [15.981, -96.55],
  'REGION COSTA ZONA PONIENTE': [16.196, -98.05],
  'REGION DE LA CANADA': [18.05, -96.94],
  'REGION DE LA CUENCA': [18.208, -96.245],
  'REGION DE LA MIXTECA': [17.647, -97.761],
  'REGION DE VALLES CENTRALES ZONA NORTE': [17.156, -96.52],
  'REGION DE VALLES CENTRALES ZONA SUR': [16.846, -96.784],
  'REGION DEL ISTMO ZONA NORTE': [16.8786, -95.0408],
  'REGION DEL ISTMO ZONA SUR': [16.3246, -95.241],
  'REGION I': [17.0654, -96.7236],
  'REGION II': [16.9841, -95.1208],
  'REGION III': [16.4322, -98.1508],
  'REGION IV': [18.3738, -96.3791],
  'REGION V': [17.7833, -97.8],
  'REGION VI': [17.5167, -96.35],
  'REGION VII': [17.0654, -96.7236],
};

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildNormalizedCoords<T extends Record<string, LatLngTuple>>(coords: T) {
  return Object.fromEntries(
    Object.entries(coords).map(([key, value]) => [normalizeKey(key), value]),
  ) as Record<string, LatLngTuple>;
}

function buildDelegationOffsetSeed(delegationName: string) {
  const normalizedName = normalizeKey(delegationName);
  let hash = 0;

  for (let index = 0; index < normalizedName.length; index += 1) {
    hash = (hash * 31 + normalizedName.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildFallbackDelegationCoords(regionCoords: LatLngTuple, delegationName: string): LatLngTuple {
  const seed = buildDelegationOffsetSeed(delegationName);
  const latOffset = (((seed % 1000) / 1000) - 0.5) * 0.22;
  const lngOffset = ((((Math.floor(seed / 1000)) % 1000) / 1000) - 0.5) * 0.22;

  return [regionCoords[0] + latOffset, regionCoords[1] + lngOffset];
}

const NORMALIZED_DELEGATION_COORDS = buildNormalizedCoords(EXACT_DELEGATION_COORDS);
const NORMALIZED_REGION_CENTROIDS = buildNormalizedCoords(REGION_CENTROIDS);

export const OAXACA_MAP_BOUNDS: LatLngBoundsExpression = [
  [14.4, -98.9],
  [18.7, -94.4],
];

export function getDelegationLatLng(
  regionName: string,
  delegationName: string,
): LatLngTuple | null {
  const normalizedDelegationName = normalizeKey(delegationName);
  const exactCoords = NORMALIZED_DELEGATION_COORDS[normalizedDelegationName];

  if (exactCoords) {
    return exactCoords;
  }

  const normalizedRegionName = normalizeKey(regionName);
  const regionCoords = NORMALIZED_REGION_CENTROIDS[normalizedRegionName];

  if (regionCoords) {
    return buildFallbackDelegationCoords(regionCoords, delegationName);
  }

  return null;
}
