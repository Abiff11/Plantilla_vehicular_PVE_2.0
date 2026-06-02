import { inflateRawSync } from 'node:zlib';

export type ParsedExcelSheet = {
  name: string;
  rows: string[][];
};

export type ParsedExcelWorkbook = {
  sheets: ParsedExcelSheet[];
};

type ZipEntry = {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

export function parseExcelWorkbook(buffer: Buffer): ParsedExcelWorkbook {
  const zipEntries = readZipEntries(buffer);
  const files = new Map<string, Buffer>();

  for (const entry of zipEntries) {
    files.set(entry.fileName, readZipEntryData(buffer, entry));
  }

  const workbookXml = readXmlFile(files, 'xl/workbook.xml');
  const workbookRelsXml = readXmlFile(files, 'xl/_rels/workbook.xml.rels');
  const sharedStrings = readSharedStrings(files.get('xl/sharedStrings.xml'));
  const relationships = readWorkbookRelationships(workbookRelsXml);
  const sheets = readWorkbookSheets(workbookXml)
    .map((sheet) => {
      const target = relationships.get(sheet.relationshipId);

      if (!target) {
        return null;
      }

      const sheetPath = normalizeWorkbookTargetPath(target);
      const sheetXml = readXmlFile(files, sheetPath);

      return {
        name: sheet.name,
        rows: parseSheetRows(sheetXml, sharedStrings),
      };
    })
    .filter((sheet): sheet is ParsedExcelSheet => sheet !== null);

  return { sheets };
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    const signature = buffer.readUInt32LE(offset);

    if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('El archivo Excel no tiene una estructura ZIP valida.');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8');

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error('No se encontro el directorio central del archivo Excel.');
}

function readZipEntryData(buffer: Buffer, entry: ZipEntry) {
  const signature = buffer.readUInt32LE(entry.localHeaderOffset);

  if (signature !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Entrada ZIP invalida: ${entry.fileName}`);
  }

  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error(`Metodo de compresion no soportado en Excel: ${entry.compressionMethod}`);
}

function readXmlFile(files: Map<string, Buffer>, path: string) {
  const file = files.get(path);

  if (!file) {
    throw new Error(`No se encontro ${path} dentro del Excel.`);
  }

  return file.toString('utf8');
}

function readSharedStrings(sharedStringsBuffer?: Buffer) {
  if (!sharedStringsBuffer) {
    return [];
  }

  const xml = sharedStringsBuffer.toString('utf8');
  const values: string[] = [];
  const sharedStringPattern = /<si[\s\S]*?<\/si>/gu;
  const matches = xml.match(sharedStringPattern) ?? [];

  for (const match of matches) {
    values.push(extractText(match));
  }

  return values;
}

function readWorkbookRelationships(xml: string) {
  const relationships = new Map<string, string>();
  const relationshipPattern = /<Relationship\b([^>]*)\/>/gu;
  let match: RegExpExecArray | null;

  while ((match = relationshipPattern.exec(xml)) !== null) {
    const attributes = readXmlAttributes(match[1]);
    const id = attributes.get('Id');
    const target = attributes.get('Target');

    if (id && target) {
      relationships.set(id, target);
    }
  }

  return relationships;
}

function readWorkbookSheets(xml: string) {
  const sheets: Array<{ name: string; relationshipId: string }> = [];
  const sheetPattern = /<sheet\b([^>]*)\/>/gu;
  let match: RegExpExecArray | null;

  while ((match = sheetPattern.exec(xml)) !== null) {
    const attributes = readXmlAttributes(match[1]);
    const name = attributes.get('name');
    const relationshipId = attributes.get('r:id');

    if (name && relationshipId) {
      sheets.push({ name: decodeXml(name), relationshipId });
    }
  }

  return sheets;
}

function normalizeWorkbookTargetPath(target: string) {
  const cleanTarget = target.replace(/^\//u, '');

  if (cleanTarget.startsWith('xl/')) {
    return cleanTarget;
  }

  return `xl/${cleanTarget}`.replace(/\/\.\//gu, '/');
}

function parseSheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowPattern = /<row\b([^>]*)>([\s\S]*?)<\/row>/gu;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const rowAttributes = readXmlAttributes(rowMatch[1]);
    const rowNumber = Number(rowAttributes.get('r')) || rows.length + 1;
    const rowValues: string[] = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gu;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[2])) !== null) {
      const cellAttributes = readXmlAttributes(cellMatch[1]);
      const cellReference = cellAttributes.get('r') ?? '';
      const columnIndex = getColumnIndex(cellReference);
      const value = readCellValue(cellMatch[2], cellAttributes.get('t'), sharedStrings);
      rowValues[columnIndex] = value;
    }

    rows[rowNumber - 1] = rowValues.map((value) => value ?? '');
  }

  return rows.filter((row) => row.some((cell) => normalizeText(cell).length > 0));
}

function readCellValue(cellXml: string, type: string | undefined, sharedStrings: string[]) {
  if (type === 'inlineStr') {
    return normalizeText(extractText(cellXml));
  }

  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/u);
  const rawValue = valueMatch ? decodeXml(valueMatch[1]) : '';

  if (type === 's') {
    return normalizeText(sharedStrings[Number(rawValue)] ?? '');
  }

  return normalizeText(rawValue);
}

function readXmlAttributes(xml: string) {
  const attributes = new Map<string, string>();
  const attributePattern = /([\w:.-]+)="([^"]*)"/gu;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(xml)) !== null) {
    attributes.set(match[1], match[2]);
  }

  return attributes;
}

function extractText(xml: string) {
  const fragments: string[] = [];
  const textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/gu;
  let match: RegExpExecArray | null;

  while ((match = textPattern.exec(xml)) !== null) {
    fragments.push(decodeXml(match[1]));
  }

  return fragments.join('');
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}

function getColumnIndex(cellReference: string) {
  const columnLetters = cellReference.match(/^[A-Z]+/u)?.[0] ?? 'A';
  let index = 0;

  for (const letter of columnLetters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }

  return index - 1;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/gu, ' ');
}
