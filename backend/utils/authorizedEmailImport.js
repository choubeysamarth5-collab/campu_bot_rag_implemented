const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { parseCsv } = require('./csvParser');
const pdfParse = require('pdf-parse');

function xmlDocument(xml) {
  const failOnMalformedXml = message => { throw new Error(message); };
  const doc = new DOMParser({ errorHandler: { warning: () => {}, error: failOnMalformedXml, fatalError: failOnMalformedXml } })
    .parseFromString(xml, 'application/xml');
  if (!doc.documentElement || doc.getElementsByTagName('parsererror').length) throw new Error('Invalid Excel workbook.');
  return doc;
}

function descendants(node, tagName) {
  return Array.from(node.getElementsByTagName(tagName));
}

function columnIndex(reference) {
  const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function readXlsx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const workbookFile = zip.file('xl/workbook.xml');
  const relationsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbookFile || !relationsFile) throw new Error('This file is not a valid .xlsx workbook.');

  const [workbookText, relationsText] = await Promise.all([workbookFile.async('string'), relationsFile.async('string')]);
  const workbook = xmlDocument(workbookText);
  const relations = xmlDocument(relationsText);
  const firstSheet = descendants(workbook, 'sheet')[0];
  if (!firstSheet) throw new Error('The workbook has no sheets.');

  const relationId = firstSheet.getAttribute('r:id') || firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const relation = descendants(relations, 'Relationship').find(item => item.getAttribute('Id') === relationId);
  if (!relation) throw new Error('Could not read the first worksheet.');
  const target = relation.getAttribute('Target').replace(/^\//, '');
  const sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error('Could not find the first worksheet in the workbook.');

  const sharedFile = zip.file('xl/sharedStrings.xml');
  const [sheetText, sharedText] = await Promise.all([
    sheetFile.async('string'),
    sharedFile ? sharedFile.async('string') : Promise.resolve(''),
  ]);
  const sheet = xmlDocument(sheetText);
  const sharedStrings = sharedText
    ? descendants(xmlDocument(sharedText), 'si').map(item => descendants(item, 't').map(text => text.textContent || '').join(''))
    : [];

  return descendants(sheet, 'row').map(row => {
    const cells = [];
    for (const cell of descendants(row, 'c')) {
      const index = columnIndex(cell.getAttribute('r'));
      const type = cell.getAttribute('t');
      let value = type === 'inlineStr'
        ? descendants(cell, 't').map(text => text.textContent || '').join('')
        : descendants(cell, 'v')[0]?.textContent || '';
      if (type === 's') value = sharedStrings[Number(value)] || '';
      cells[index] = value;
    }
    return cells;
  });
}

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/[\s_\-/]+/g, '');
}

function rowsToRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const findColumn = aliases => headers.findIndex(header => aliases.includes(header));
  const emailIndex = findColumn(['email', 'emailaddress', 'collegeemail', 'emailid']);
  if (emailIndex < 0) throw new Error('File must include an Email column. Optional columns: Name, Branch/Department, Semester.');
  const nameIndex = findColumn(['name', 'fullname', 'studentname']);
  const branchIndex = findColumn(['branch', 'department', 'branchdepartment']);
  const semesterIndex = findColumn(['semester', 'sem']);

  return rows.slice(1).map((row, index) => ({
    email: String(row[emailIndex] || '').trim().toLowerCase(),
    name: nameIndex < 0 ? '' : String(row[nameIndex] || '').trim(),
    branch: branchIndex < 0 ? '' : String(row[branchIndex] || '').trim(),
    semester: semesterIndex < 0 ? '' : String(row[semesterIndex] || '').trim(),
    sourceRow: index + 2,
  })).filter(record => record.email || record.name || record.branch || record.semester);
}

async function parseAuthorizedEmailFile(file) {
  const filename = String(file.originalname || '').toLowerCase();
  let rows;
  if (filename.endsWith('.pdf')) {
    const parsedPdf = await pdfParse(file.buffer);
    const records = [];
    String(parsedPdf.text || '').split(/\r?\n/).forEach((line, index) => {
      const emails = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      emails.forEach(email => {
        const branch = line.match(/(?:branch|department)\s*[:=-]\s*([^|,;]+)/i)?.[1]?.trim() || '';
        const semester = line.match(/(?:semester|sem)\s*[:=-]?\s*(10|[1-9])\b/i)?.[1] || '';
        const name = line.replace(email, '').replace(/(?:email|e-mail)\s*[:=-]?/ig, '').replace(/[|,;\t]+/g, ' ').trim();
        records.push({ email: email.toLowerCase(), name: name.length <= 100 ? name : '', branch: branch.slice(0, 100), semester, sourceRow: index + 1 });
      });
    });
    if (records.length > 5000) throw new Error('A single PDF can contain at most 5,000 email rows.');
    if (!records.length) throw new Error(`No email addresses found in ${file.originalname}.`);
    return records;
  }
  if (filename.endsWith('.xlsx')) {
    rows = await readXlsx(file.buffer);
  } else if (filename.endsWith('.csv') || filename.endsWith('.tsv')) {
    const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const delimiter = filename.endsWith('.tsv') ? '\t' : ',';
    if (delimiter === ',') {
      const parsed = parseCsv(text);
      const headers = Object.keys(parsed[0] || {});
      rows = parsed.length ? [headers, ...parsed.map(row => headers.map(header => row[header]))] : [];
    }
    else {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      rows = lines.map(line => line.split('\t').map(value => value.trim()));
    }
  } else {
    throw new Error('Upload an .xlsx, .csv, .tsv, or text-based .pdf file.');
  }

  if (rows.length > 5001) throw new Error('A single import can contain at most 5,000 email rows.');
  return rowsToRecords(rows);
}

module.exports = { parseAuthorizedEmailFile };
