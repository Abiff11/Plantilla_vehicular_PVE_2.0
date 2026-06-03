import { DelegationEntity } from 'src/modules/catalog/entities/delegation.entity';
import type { NormalizedExcelImportRecord } from './excel-import-normalizer';

type ImportDelegationRow = {
  sourceSection: string;
  values: Record<string, string>;
  normalized: NormalizedExcelImportRecord;
};

type DelegationScore = {
  delegation: DelegationEntity;
  score: number;
  matchedBy: string;
};

const STOP_WORDS = new Set([
  'DE',
  'DEL',
  'LA',
  'LAS',
  'LOS',
  'EL',
  'Y',
  'SAN',
  'SANTA',
  'SANTO',
  'REGION',
  'ZONA',
  'POLICIA',
  'VIAL',
  'ESTATAL',
  'DELEGACION',
  'COMANDANCIA',
]);

export function resolveImportDelegation(
  row: ImportDelegationRow,
  delegations: DelegationEntity[],
) {
  const candidates = buildCandidateTexts(row);
  const scores = delegations
    .map((delegation) => scoreDelegation(delegation, candidates, delegations))
    .filter((score) => score.score >= 60)
    .sort((left, right) => right.score - left.score);

  return scores[0]?.delegation ?? null;
}

export function buildDelegationResolutionError(row: ImportDelegationRow) {
  const candidates = buildCandidateTexts(row).slice(0, 5).join(' | ');

  return candidates
    ? `No se pudo asociar delegacion/region desde Excel. Valores revisados: ${candidates}.`
    : 'No se pudo asociar delegacion/region desde Excel porque la fila no trae adscripcion, ubicacion real ni seccion util.';
}

function buildCandidateTexts(row: ImportDelegationRow) {
  return Array.from(
    new Set(
      [
        row.values.ADSCRIPCION,
        row.values['UBICACION REAL'],
        row.sourceSection,
        row.normalized.adscription,
        row.normalized.realLocation,
        row.normalized.sourceSection,
      ]
        .map((value) => normalizeImportText(value))
        .filter(Boolean),
    ),
  );
}

function scoreDelegation(
  delegation: DelegationEntity,
  candidates: string[],
  delegations: DelegationEntity[],
): DelegationScore {
  const delegationName = normalizeImportText(delegation.name);
  const delegationVariants = buildDelegationVariants(delegationName);
  let bestScore = 0;
  let matchedBy = '';

  for (const candidate of candidates) {
    for (const variant of delegationVariants) {
      const score = scoreCandidate(candidate, variant, delegations);

      if (score > bestScore) {
        bestScore = score;
        matchedBy = candidate;
      }
    }
  }

  return { delegation, score: bestScore, matchedBy };
}

function scoreCandidate(candidate: string, delegationName: string, delegations: DelegationEntity[]) {
  if (!candidate || !delegationName) {
    return 0;
  }

  if (candidate === delegationName) {
    return 100;
  }

  if (candidate.includes(delegationName) || delegationName.includes(candidate)) {
    return candidate.length >= 4 && delegationName.length >= 4 ? 90 : 0;
  }

  const delegationTokens = getMeaningfulTokens(delegationName);
  const candidateTokens = new Set(getMeaningfulTokens(candidate));
  const matchedTokens = delegationTokens.filter((token) => candidateTokens.has(token));

  if (matchedTokens.length >= 2) {
    return 75 + matchedTokens.length;
  }

  if (matchedTokens.length === 1) {
    const token = matchedTokens[0];

    if (isUniqueDelegationToken(token, delegations)) {
      return token.length >= 4 ? 70 : 0;
    }
  }

  return 0;
}

function buildDelegationVariants(delegationName: string) {
  const variants = new Set([delegationName]);

  variants.add(delegationName.replace(/\bMA\b/gu, 'MARIA'));
  variants.add(delegationName.replace(/\bP\s*D\b/gu, 'PORFIRIO DIAZ'));
  variants.add(delegationName.replace(/\bGRO\b/gu, 'GUERRERO'));
  variants.add(delegationName.replace(/\bS\s*P\b/gu, 'SAN PEDRO'));

  return Array.from(variants).filter(Boolean);
}

function getMeaningfulTokens(value: string) {
  return normalizeImportText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function isUniqueDelegationToken(token: string, delegations: DelegationEntity[]) {
  let matches = 0;

  for (const delegation of delegations) {
    const tokens = getMeaningfulTokens(delegation.name);

    if (tokens.includes(token)) {
      matches += 1;
    }
  }

  return matches === 1;
}

function normalizeImportText(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/\bSTA\b/gu, 'SANTA')
    .replace(/\bS\.?\s*P\.?\b/gu, 'SAN PEDRO')
    .replace(/\bP\.?\s*D\.?\b/gu, 'PORFIRIO DIAZ')
    .replace(/\bGRO\.?\b/gu, 'GUERRERO')
    .replace(/[^A-Z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}
