/**
 * Desjardins TEF Validator — CPA-005 Format
 * Design: Terminal/Diagnostic Tool — IBM Plex Mono, vert Desjardins (#00874A)
 *
 * Validates a TEF file against the Desjardins/CPA-005 spec (PDF section 12).
 * Field positions are taken DIRECTLY from the official Desjardins specification PDF.
 *
 * Record A (En-tête): 1 per file, 1464 chars
 * Record C (Crédit):  1+ per file, 1464 chars each (6 segments of 240 chars)
 * Record Z (Pied):    1 per file, 1464 chars
 * Line separator: CRLF (\r\n)
 *
 * BC Canada behavior: codeunit 10322 trims trailing spaces from all lines.
 * Short lines are treated as warnings (not errors) as long as mandatory fields are present.
 */

export type Severity = "error" | "warning" | "info";

export interface FieldError {
  field: string;
  position: string;
  expected: string;
  actual: string;
  severity: Severity;
  message: string;
}

export interface RecordResult {
  lineNumber: number;
  recordType: "A" | "C" | "Z" | "UNKNOWN";
  label: string;
  valid: boolean;
  errors: FieldError[];
  fields: ParsedField[];
}

export interface ParsedField {
  name: string;
  position: string;
  length: number;
  value: string;
  valid: boolean;
  note?: string;
}

export interface ValidationSummary {
  valid: boolean;
  totalLines: number;
  recordA: number;
  recordC: number;
  recordZ: number;
  totalErrors: number;
  totalWarnings: number;
  records: RecordResult[];
  globalErrors: FieldError[];
  stats: {
    totalAmount: number;
    transactionCount: number;
    organisme: string;
    dateCreation: string;
    fichierNum: string;
  };
}

const LINE_LENGTH = 1464;

// Valid CPA-005 operation types (from PDF table — all types 200-730 are valid)
// The most common ones used by Desjardins clients are listed here.
// Any 3-digit numeric value in range 200-899 is technically valid per CPA-005.
const VALID_OPERATION_TYPES = new Set([
  "200","201","202","203","204","205","206","207",
  "230","231","232","233",
  "240","250","251","252",
  "260","261","265","266","271","272","273","274",
  "280","281",
  "300","301","302","303","308","309","310","311","312","313","314","315","316","317","318","320","321","322","323","324",
  "330","331","332","333","334","335","336",
  "350","351","352","353","354","355","356",
  "370","371","372","373",
  "380","381","382","383","384","385","386",
  "400","401","402","403","404","405",
  "420","430","431","432","433","434","435","436","437","438","439",
  "450","451","452","460","470","480",
  "600","601","602","603","604","605","606","607","608","609","610",
  "611","612","613","614","615","616","617","650","700",
  "701","702","703","704","705","706","707","708","709","710","711","712","713","714","715","716","717","718","719",
  "720","721","722","723","724","725","726","727","728","729","730",
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function isNumeric(s: string): boolean {
  return /^\d+$/.test(s);
}

function isAlphaNumericExtended(s: string): boolean {
  // CPA-005 alphanumeric: letters, digits, spaces, hyphens, periods, commas, apostrophes, slashes, &
  return /^[A-Za-z0-9 \-.,'/&éèêëàâùûüîïôçÉÈÊËÀÂÙÛÜÎÏÔÇ]*$/.test(s);
}

function isValidAccountNumber(s: string): boolean {
  // Account numbers can contain digits, spaces, and hyphens (e.g. 999-999-9)
  return /^[0-9\- ]+$/.test(s.trim()) && s.trim().length > 0;
}

function isBlank(s: string): boolean {
  return /^ *$/.test(s);
}

function isZeros(s: string): boolean {
  return /^0+$/.test(s);
}

function isJulianDate(s: string): boolean {
  // Format 0AAJJJ: 0 + 2-digit year + 3-digit day-of-year (001-366)
  if (!/^0\d{5}$/.test(s)) return false;
  const day = parseInt(s.substring(3, 6), 10);
  return day >= 1 && day <= 366;
}

function checkField(
  errors: FieldError[],
  fields: ParsedField[],
  name: string,
  position: string,
  value: string,
  length: number,
  checks: {
    numeric?: boolean;
    alphanumericExtended?: boolean;
    accountNumber?: boolean;
    blank?: boolean;
    zeros?: boolean;
    oneOf?: string[];
    notBlank?: boolean;
    regex?: RegExp;
    regexDesc?: string;
    julianDate?: boolean;
    validOpType?: boolean;
    institutionNumber?: boolean;
  },
  severity: Severity = "error"
): void {
  const field: ParsedField = { name, position, length, value, valid: true };
  const issues: string[] = [];

  if (value.length !== length) {
    issues.push(`longueur ${value.length} ≠ ${length} attendu`);
  }

  if (checks.numeric && !isNumeric(value)) {
    issues.push("doit être numérique (chiffres 0-9 uniquement)");
  }
  if (checks.alphanumericExtended && !isAlphaNumericExtended(value)) {
    issues.push("caractères non alphanumériques détectés");
  }
  if (checks.accountNumber && !isValidAccountNumber(value)) {
    issues.push("numéro de compte invalide (chiffres, espaces, tirets acceptés)");
  }
  if (checks.blank && !isBlank(value)) {
    issues.push("doit être vide (espaces)");
  }
  if (checks.zeros && !isZeros(value)) {
    issues.push("doit être zéros");
  }
  if (checks.notBlank && isBlank(value)) {
    issues.push("ne doit pas être vide — champ obligatoire");
  }
  if (checks.oneOf && !checks.oneOf.includes(value)) {
    issues.push(`doit être l'une de: ${checks.oneOf.join(", ")}`);
  }
  if (checks.regex && !checks.regex.test(value)) {
    issues.push(checks.regexDesc || "format invalide");
  }
  if (checks.julianDate && !isJulianDate(value)) {
    issues.push("format date invalide — attendu 0AAJJJ (ex: 025349 = 349e jour de 2025)");
  }
  if (checks.validOpType && !VALID_OPERATION_TYPES.has(value)) {
    issues.push(`type d'opération inconnu "${value}" — voir liste CPA-005 (200-730)`);
  }
  if (checks.institutionNumber) {
    // Format: 0 + 3-digit institution + 5-digit transit (e.g. 081510108)
    if (!/^0\d{8}$/.test(value)) {
      issues.push("format institution invalide — attendu 0IIITTTTT (0 + 3 chiffres institution + 5 chiffres transit)");
    }
  }

  if (issues.length > 0) {
    field.valid = false;
    field.note = issues.join("; ");
    errors.push({
      field: name,
      position,
      expected: checks.regexDesc || checks.oneOf?.join("/") || Object.keys(checks).filter(k => (checks as Record<string,unknown>)[k]).join(", "),
      actual: JSON.stringify(value),
      severity,
      message: `${name} (pos ${position}): ${issues.join("; ")}`,
    });
  }

  fields.push(field);
}

// ─── Record A — En-tête de fichier ──────────────────────────────────────────
// Source: PDF section 12.4, page 78
//
// Pos  1      (1):  Type enregistrement = "A"
// Pos  2-10   (9):  Numéro de l'enregistrement logique = "000000001"
// Pos  11-20  (10): Numéro de l'organisme (numérique)
// Pos  21-24  (4):  Numéro de fichier (numérique)
// Pos  25-30  (6):  Date de création (0AAJJJ)
// Pos  31-35  (5):  Centrale informatique Desjardins = "81510"
// Pos  36-55  (20): Caractères de remplissage
// Pos  56-58  (3):  Identificateur du code de monnaie (CAD ou USD)
// Pos  59-1464(1406): Caractères de remplissage

function validateRecordA(line: string, lineNum: number): RecordResult {
  const errors: FieldError[] = [];
  const fields: ParsedField[] = [];

  // BC Canada codeunit 10322 trims trailing spaces — pad to 1464 before parsing
  const padded = line.padEnd(LINE_LENGTH, " ");
  const f = (start: number, len: number) => padded.substring(start - 1, start - 1 + len);

  // Warn if line was shorter than 1464 (trailing spaces stripped by BC Canada)
  if (line.length < LINE_LENGTH) {
    errors.push({
      field: "Longueur ligne A",
      position: "1-1464",
      expected: `${LINE_LENGTH} caractères`,
      actual: `${line.length} caractères`,
      severity: "warning",
      message: `Ligne A: ${line.length} chars — espaces de fin supprimés par BC Canada codeunit 10322 (comportement normal)`,
    });
  }

  // Pos 1 (1): Type enregistrement = "A"
  checkField(errors, fields, "Type enregistrement", "1", f(1, 1), 1, { oneOf: ["A"] });

  // Pos 2-10 (9): Numéro de l'enregistrement logique = "000000001"
  checkField(errors, fields, "Numéro enregistrement logique", "2-10", f(2, 9), 9, {
    oneOf: ["000000001"],
  });

  // Pos 11-20 (10): Numéro de l'organisme (numérique, obligatoire)
  checkField(errors, fields, "Numéro de l'organisme", "11-20", f(11, 10), 10, {
    numeric: true,
    notBlank: true,
  });

  // Pos 21-24 (4): Numéro de fichier (numérique)
  checkField(errors, fields, "Numéro de fichier", "21-24", f(21, 4), 4, { numeric: true });

  // Pos 25-30 (6): Date de création (0AAJJJ)
  checkField(errors, fields, "Date de création", "25-30", f(25, 6), 6, {
    julianDate: true,
    regexDesc: "format 0AAJJJ (ex: 025349 = 349e jour de 2025)",
  });

  // Pos 31-35 (5): Centrale informatique Desjardins = "81510"
  checkField(errors, fields, "Centrale Desjardins", "31-35", f(31, 5), 5, {
    oneOf: ["81510"],
  });

  // Pos 36-55 (20): Caractères de remplissage (espaces)
  checkField(errors, fields, "Remplissage (36-55)", "36-55", f(36, 20), 20, { blank: true }, "warning");

  // Pos 56-58 (3): Identificateur du code de monnaie
  const currency = f(56, 3);
  checkField(errors, fields, "Code de monnaie", "56-58", currency, 3, {
    oneOf: ["CAD", "USD", "CAN", "   "],
  }, "warning");

  // Pos 59-1464 (1406): Caractères de remplissage
  const fill = f(59, 1406);
  fields.push({
    name: "Remplissage (59-1464)",
    position: "59-1464",
    length: 1406,
    value: fill,
    valid: true,
    note: fill.trim() ? `Contient: "${fill.trim().substring(0, 40)}"` : "vide (espaces)",
  });

  return {
    lineNumber: lineNum,
    recordType: "A",
    label: "Enregistrement A — En-tête de fichier",
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
    fields,
  };
}

// ─── Record C — Crédit (Dépôt direct) ───────────────────────────────────────
// Source: PDF section 12.4, pages 78-79
//
// En-tête (commun à tous les segments):
// Pos  1      (1):  Type enregistrement = "C"
// Pos  2-10   (9):  Numéro de l'enregistrement logique
// Pos  11-20  (10): Numéro de l'organisme
// Pos  21-24  (4):  Numéro de fichier
//
// Segment 1 (positions 25-264):
// Pos  25-27  (3):  Type d'opération (numérique, voir liste CPA-005)
// Pos  28-37  (10): Montant (en cents, zéro-paddé à gauche)
// Pos  38-43  (6):  Date de disponibilité des fonds (0AAJJJ)
// Pos  44-52  (9):  Numéro de l'institution financière du bénéficiaire (0IIITTTTT)
// Pos  53-64  (12): Numéro de compte du bénéficiaire (alphanumérique, tirets acceptés)
// Pos  65-86  (22): Numéro de repère (zéros)
// Pos  87-89  (3):  Type d'opération initiale (zéros)
// Pos  90-104 (15): Nom abrégé de l'organisme (alphanumérique)
// Pos  105-134(30): Nom du bénéficiaire (alphanumérique, obligatoire)
// Pos  135-164(30): Nom de l'organisme (alphanumérique)
// Pos  165-174(10): Numéro de l'organisme (numérique)
// Pos  175-193(19): Numéro de référence (alphanumérique)
// Pos  194-202(9):  Numéro de l'institution pour les retours (0IIITTTTT)
// Pos  203-214(12): Numéro de compte pour les retours (alphanumérique)
// Pos  215-229(15): Champ réservé à l'organisme (alphanumérique)
// Pos  230-251(22): Caractères de remplissage
// Pos  252-253(2):  Code de règlement (blancs)
// Pos  254-264(11): Identification d'éléments non valides (zéros)
//
// Segments 2-6: même disposition (265-504, 505-744, 745-984, 985-1224, 1225-1464)

function validateRecordC(line: string, lineNum: number): RecordResult {
  const errors: FieldError[] = [];
  const fields: ParsedField[] = [];

  // BC Canada codeunit 10322 trims trailing spaces — pad to 1464 before parsing
  const padded = line.padEnd(LINE_LENGTH, " ");
  const f = (start: number, len: number) => padded.substring(start - 1, start - 1 + len);

  // Pos 1 (1): Type enregistrement = "C"
  checkField(errors, fields, "Type enregistrement", "1", f(1, 1), 1, { oneOf: ["C"] });

  // Pos 2-10 (9): Numéro de l'enregistrement logique (numérique)
  checkField(errors, fields, "Numéro enregistrement logique", "2-10", f(2, 9), 9, { numeric: true });

  // Pos 11-20 (10): Numéro de l'organisme (numérique, obligatoire)
  checkField(errors, fields, "Numéro de l'organisme", "11-20", f(11, 10), 10, {
    numeric: true,
    notBlank: true,
  });

  // Pos 21-24 (4): Numéro de fichier (numérique)
  checkField(errors, fields, "Numéro de fichier", "21-24", f(21, 4), 4, { numeric: true });

  // ── Segment 1 ──

  // Pos 25-27 (3): Type d'opération (numérique, liste CPA-005)
  const typeOp = f(25, 3);
  if (!isNumeric(typeOp)) {
    errors.push({
      field: "Type d'opération",
      position: "25-27",
      expected: "numérique 3 chiffres (ex: 200, 450, 718, 729)",
      actual: JSON.stringify(typeOp),
      severity: "error",
      message: `Type d'opération (pos 25-27): doit être numérique — valeur: "${typeOp}"`,
    });
    fields.push({ name: "Type d'opération", position: "25-27", length: 3, value: typeOp, valid: false });
  } else if (!VALID_OPERATION_TYPES.has(typeOp)) {
    errors.push({
      field: "Type d'opération",
      position: "25-27",
      expected: "code CPA-005 valide (200-730)",
      actual: typeOp,
      severity: "warning",
      message: `Type d'opération (pos 25-27): code "${typeOp}" non reconnu dans la liste CPA-005 — peut être valide pour usage futur`,
    });
    fields.push({ name: "Type d'opération", position: "25-27", length: 3, value: typeOp, valid: true, note: "Code non standard" });
  } else {
    fields.push({ name: "Type d'opération", position: "25-27", length: 3, value: typeOp, valid: true });
  }

  // Pos 28-37 (10): Montant en cents (numérique, zéro-paddé, > 0)
  const montant = f(28, 10);
  checkField(errors, fields, "Montant (cents)", "28-37", montant, 10, { numeric: true });
  if (isNumeric(montant) && parseInt(montant, 10) === 0) {
    errors.push({
      field: "Montant",
      position: "28-37",
      expected: "> 0",
      actual: montant,
      severity: "error",
      message: "Montant (pos 28-37): doit être supérieur à zéro — opération rejetée si montant = 0",
    });
  }

  // Pos 38-43 (6): Date de disponibilité des fonds (0AAJJJ)
  checkField(errors, fields, "Date de disponibilité des fonds", "38-43", f(38, 6), 6, {
    julianDate: true,
    regexDesc: "format 0AAJJJ (ex: 025349 = 349e jour de 2025)",
  });

  // Pos 44-52 (9): Numéro de l'institution financière du bénéficiaire (0IIITTTTT)
  checkField(errors, fields, "Institution financière bénéficiaire", "44-52", f(44, 9), 9, {
    institutionNumber: true,
  });

  // Pos 53-64 (12): Numéro de compte du bénéficiaire (alphanumérique, tirets acceptés)
  const cptBen = f(53, 12);
  if (!isValidAccountNumber(cptBen) && !isBlank(cptBen)) {
    errors.push({
      field: "Numéro de compte bénéficiaire",
      position: "53-64",
      expected: "chiffres, espaces ou tirets (ex: 0682591, 999-999-9)",
      actual: JSON.stringify(cptBen),
      severity: "error",
      message: `Numéro de compte bénéficiaire (pos 53-64): format invalide "${cptBen.trim()}"`,
    });
    fields.push({ name: "Numéro de compte bénéficiaire", position: "53-64", length: 12, value: cptBen, valid: false });
  } else {
    fields.push({ name: "Numéro de compte bénéficiaire", position: "53-64", length: 12, value: cptBen, valid: true });
  }

  // Pos 65-86 (22): Numéro de repère (doit être zéros lors de la présentation initiale)
  const repere = f(65, 22);
  if (!isZeros(repere) && !isBlank(repere)) {
    errors.push({
      field: "Numéro de repère",
      position: "65-86",
      expected: "zéros (000...000)",
      actual: JSON.stringify(repere),
      severity: "error",
      message: `Numéro de repère (pos 65-86): doit être zéros lors de la présentation initiale — valeur: "${repere.trim()}"`,
    });
    fields.push({ name: "Numéro de repère", position: "65-86", length: 22, value: repere, valid: false });
  } else {
    fields.push({ name: "Numéro de repère", position: "65-86", length: 22, value: repere, valid: true });
  }

  // Pos 87-89 (3): Type d'opération initiale (doit être zéros lors de la présentation initiale)
  const typeOpInit = f(87, 3);
  if (!isZeros(typeOpInit) && !isBlank(typeOpInit)) {
    errors.push({
      field: "Type d'opération initiale",
      position: "87-89",
      expected: "000",
      actual: JSON.stringify(typeOpInit),
      severity: "error",
      message: `Type d'opération initiale (pos 87-89): doit être "000" lors de la présentation initiale — valeur: "${typeOpInit}"`,
    });
    fields.push({ name: "Type d'opération initiale", position: "87-89", length: 3, value: typeOpInit, valid: false });
  } else {
    fields.push({ name: "Type d'opération initiale", position: "87-89", length: 3, value: typeOpInit, valid: true });
  }

  // Pos 90-104 (15): Nom abrégé de l'organisme (alphanumérique, obligatoire)
  checkField(errors, fields, "Nom abrégé de l'organisme", "90-104", f(90, 15), 15, {
    alphanumericExtended: true,
    notBlank: true,
  });

  // Pos 105-134 (30): Nom du bénéficiaire (alphanumérique, obligatoire)
  checkField(errors, fields, "Nom du bénéficiaire", "105-134", f(105, 30), 30, {
    alphanumericExtended: true,
    notBlank: true,
  });

  // Pos 135-164 (30): Nom de l'organisme (alphanumérique)
  checkField(errors, fields, "Nom de l'organisme", "135-164", f(135, 30), 30, {
    alphanumericExtended: true,
  });

  // Pos 165-174 (10): Numéro de l'organisme (numérique, obligatoire)
  checkField(errors, fields, "Numéro de l'organisme (retours)", "165-174", f(165, 10), 10, {
    numeric: true,
    notBlank: true,
  });

  // Pos 175-193 (19): Numéro de référence (alphanumérique)
  checkField(errors, fields, "Numéro de référence", "175-193", f(175, 19), 19, {
    alphanumericExtended: true,
  });

  // Pos 194-202 (9): Numéro de l'institution pour les retours (0IIITTTTT)
  checkField(errors, fields, "Institution pour les retours", "194-202", f(194, 9), 9, {
    institutionNumber: true,
  });

  // Pos 203-214 (12): Numéro de compte pour les retours (alphanumérique, obligatoire)
  const cptRet = f(203, 12);
  if (!isValidAccountNumber(cptRet) && !isBlank(cptRet)) {
    errors.push({
      field: "Numéro de compte pour les retours",
      position: "203-214",
      expected: "chiffres, espaces ou tirets",
      actual: JSON.stringify(cptRet),
      severity: "error",
      message: `Numéro de compte pour les retours (pos 203-214): format invalide "${cptRet.trim()}"`,
    });
    fields.push({ name: "Numéro de compte pour les retours", position: "203-214", length: 12, value: cptRet, valid: false });
  } else {
    fields.push({ name: "Numéro de compte pour les retours", position: "203-214", length: 12, value: cptRet, valid: true });
  }

  // Pos 215-229 (15): Champ réservé à l'organisme (alphanumérique, peut être vide)
  const reserveOrg = f(215, 15);
  fields.push({
    name: "Champ réservé à l'organisme",
    position: "215-229",
    length: 15,
    value: reserveOrg,
    valid: true,
    note: reserveOrg.trim() ? `Contient: "${reserveOrg.trim()}"` : "vide",
  });

  // Pos 230-251 (22): Caractères de remplissage (espaces)
  checkField(errors, fields, "Remplissage (230-251)", "230-251", f(230, 22), 22, { blank: true }, "warning");

  // Pos 252-253 (2): Code de règlement (blancs — pour usage futur)
  checkField(errors, fields, "Code de règlement", "252-253", f(252, 2), 2, { blank: true }, "warning");

  // Pos 254-264 (11): Identification d'éléments de donnée non valides (zéros)
  const idNonValide = f(254, 11);
  if (!isZeros(idNonValide) && !isBlank(idNonValide)) {
    errors.push({
      field: "Identification éléments non valides",
      position: "254-264",
      expected: "00000000000",
      actual: JSON.stringify(idNonValide),
      severity: "error",
      message: `Identification éléments non valides (pos 254-264): doit être zéros lors de la présentation initiale — valeur: "${idNonValide}"`,
    });
    fields.push({ name: "Identification éléments non valides", position: "254-264", length: 11, value: idNonValide, valid: false });
  } else {
    fields.push({ name: "Identification éléments non valides", position: "254-264", length: 11, value: idNonValide, valid: true });
  }

  // Segments 2-6 (265-1464): même disposition que segment 1
  // Si l'enregistrement ne contient qu'un seul segment, les segments 2-6 doivent être remplis d'espaces
  const seg2to6 = f(265, 1200);
  const seg2to6Trimmed = seg2to6.trim();
  fields.push({
    name: "Segments 2-6 (265-1464)",
    position: "265-1464",
    length: 1200,
    value: seg2to6,
    valid: true,
    note: seg2to6Trimmed
      ? `Contient des données (${seg2to6Trimmed.length} chars non-vides) — segments supplémentaires présents`
      : "vide (espaces) — segment unique",
  });

  return {
    lineNumber: lineNum,
    recordType: "C",
    label: `Enregistrement C — Dépôt direct (ligne ${lineNum})`,
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
    fields,
  };
}

// ─── Record Z — Pied de fichier ──────────────────────────────────────────────
// Source: PDF section 12.4, page 81
//
// Pos  1      (1):  Type enregistrement = "Z"
// Pos  2-10   (9):  Numéro de l'enregistrement logique
// Pos  11-20  (10): Numéro de l'organisme
// Pos  21-24  (4):  Numéro de fichier
// Pos  25-38  (14): Valeur totale des opérations de type D
// Pos  39-46  (8):  Nombre total d'opérations de type D
// Pos  47-60  (14): Valeur totale des opérations de type C
// Pos  61-68  (8):  Nombre total d'opérations de type C
// Pos  69-82  (14): Réservé Desjardins (zéros)
// Pos  83-90  (8):  Réservé Desjardins (zéros)
// Pos  91-104 (14): Réservé Desjardins (zéros)
// Pos  105-112(8):  Réservé Desjardins (zéros)
// Pos  113-1464(1352): Caractères de remplissage

function validateRecordZ(
  line: string,
  lineNum: number,
  expectedCCount: number,
  expectedCAmount: number
): RecordResult {
  const errors: FieldError[] = [];
  const fields: ParsedField[] = [];

  // BC Canada codeunit 10322 trims trailing spaces — pad to 1464 before parsing
  const padded = line.padEnd(LINE_LENGTH, " ");
  const f = (start: number, len: number) => padded.substring(start - 1, start - 1 + len);

  // Warn if line was shorter than 1464
  if (line.length < LINE_LENGTH) {
    errors.push({
      field: "Longueur ligne Z",
      position: "1-1464",
      expected: `${LINE_LENGTH} caractères`,
      actual: `${line.length} caractères`,
      severity: "warning",
      message: `Ligne Z: ${line.length} chars — espaces de fin supprimés par BC Canada codeunit 10322 (comportement normal)`,
    });
  }

  // Pos 1 (1): Type enregistrement = "Z"
  checkField(errors, fields, "Type enregistrement", "1", f(1, 1), 1, { oneOf: ["Z"] });

  // Pos 2-10 (9): Numéro de l'enregistrement logique (numérique)
  checkField(errors, fields, "Numéro enregistrement logique", "2-10", f(2, 9), 9, { numeric: true });

  // Pos 11-20 (10): Numéro de l'organisme (numérique, obligatoire)
  checkField(errors, fields, "Numéro de l'organisme", "11-20", f(11, 10), 10, {
    numeric: true,
    notBlank: true,
  });

  // Pos 21-24 (4): Numéro de fichier (numérique)
  checkField(errors, fields, "Numéro de fichier", "21-24", f(21, 4), 4, { numeric: true });

  // Pos 25-38 (14): Valeur totale des opérations de type D
  checkField(errors, fields, "Valeur totale opérations type D", "25-38", f(25, 14), 14, { numeric: true });

  // Pos 39-46 (8): Nombre total d'opérations de type D
  checkField(errors, fields, "Nombre total opérations type D", "39-46", f(39, 8), 8, { numeric: true });

  // Pos 47-60 (14): Valeur totale des opérations de type C
  const totalC = f(47, 14);
  checkField(errors, fields, "Valeur totale opérations type C", "47-60", totalC, 14, { numeric: true });

  // Pos 61-68 (8): Nombre total d'opérations de type C
  const countC = f(61, 8);
  checkField(errors, fields, "Nombre total opérations type C", "61-68", countC, 8, { numeric: true });

  // Pos 69-82 (14): Réservé Desjardins (zéros)
  checkField(errors, fields, "Réservé Desjardins (69-82)", "69-82", f(69, 14), 14, { zeros: true }, "warning");

  // Pos 83-90 (8): Réservé Desjardins (zéros)
  checkField(errors, fields, "Réservé Desjardins (83-90)", "83-90", f(83, 8), 8, { zeros: true }, "warning");

  // Pos 91-104 (14): Réservé Desjardins (zéros)
  checkField(errors, fields, "Réservé Desjardins (91-104)", "91-104", f(91, 14), 14, { zeros: true }, "warning");

  // Pos 105-112 (8): Réservé Desjardins (zéros)
  checkField(errors, fields, "Réservé Desjardins (105-112)", "105-112", f(105, 8), 8, { zeros: true }, "warning");

  // Pos 113-1464 (1352): Caractères de remplissage
  checkField(errors, fields, "Remplissage (113-1464)", "113-1464", f(113, 1352), 1352, { blank: true }, "warning");

  // ── Cross-validation: Valeur totale C doit correspondre à la somme des montants C ──
  const parsedTotalC = parseInt(totalC.trim(), 10);
  if (!isNaN(parsedTotalC) && expectedCAmount > 0) {
    if (parsedTotalC !== expectedCAmount) {
      errors.push({
        field: "Valeur totale opérations type C",
        position: "47-60",
        expected: String(expectedCAmount),
        actual: String(parsedTotalC),
        severity: "warning",
        message: `Total C en Z (${parsedTotalC} cents = $${(parsedTotalC/100).toFixed(2)}) ≠ somme des montants C (${expectedCAmount} cents = $${(expectedCAmount/100).toFixed(2)}) — vérifier les montants`,
      });
    }
  }

  // ── Cross-validation: Nombre total C doit correspondre au nombre d'enregistrements C ──
  const parsedCountC = parseInt(countC.trim(), 10);
  if (!isNaN(parsedCountC) && expectedCCount > 0 && parsedCountC !== expectedCCount) {
    errors.push({
      field: "Nombre total opérations type C",
      position: "61-68",
      expected: String(expectedCCount),
      actual: String(parsedCountC),
      severity: "warning",
      message: `Nombre C en Z (${parsedCountC}) ≠ nombre réel d'enregistrements C (${expectedCCount})`,
    });
  }

  return {
    lineNumber: lineNum,
    recordType: "Z",
    label: "Enregistrement Z — Pied de fichier",
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
    fields,
  };
}

// ─── Main Validator ──────────────────────────────────────────────────────────

export function validateTEFFile(content: string): ValidationSummary {
  const globalErrors: FieldError[] = [];

  // Normalize line endings — accept CRLF or LF
  const rawLines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Remove trailing empty lines and DOS EOF control characters (\x1a = Ctrl+Z)
  const lines = rawLines.filter((l, i) => {
    if (i === rawLines.length - 1 && (l === "" || l === "\x1a" || l.trim() === "")) return false;
    if (l.length === 1 && l.charCodeAt(0) < 32) return false;
    return true;
  });

  const records: RecordResult[] = [];
  let recordACount = 0;
  let recordCCount = 0;
  let recordZCount = 0;
  let totalAmountCents = 0;
  let organisme = "";
  let dateCreation = "";
  let fichierNum = "";

  // ── Pass 1: validate each line ──
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const type = line[0];

    // Check line length
    if (line.length !== LINE_LENGTH) {
      // BC Canada codeunit 10322 trims trailing spaces from ALL lines (A, C, Z)
      // Minimum length to be parseable: 264 chars for C (through pos 264), 112 for A/Z
      const minLen = type === "C" ? 264 : 112;
      if (line.length < minLen) {
        globalErrors.push({
          field: `Ligne ${lineNum}`,
          position: "1-1464",
          expected: `${LINE_LENGTH} caractères`,
          actual: `${line.length} caractères`,
          severity: "error",
          message: `Ligne ${lineNum} (type ${type || "?"}): trop courte (${line.length} chars) — champs obligatoires manquants`,
        });
      } else {
        globalErrors.push({
          field: `Ligne ${lineNum}`,
          position: "1-1464",
          expected: `${LINE_LENGTH} caractères`,
          actual: `${line.length} caractères`,
          severity: "warning",
          message: `Ligne ${lineNum} (type ${type}): ${line.length} chars — espaces de fin supprimés par BC Canada (comportement normal)`,
        });
      }
    }

    if (type === "A") {
      recordACount++;
      const result = validateRecordA(line, lineNum);
      records.push(result);
      // Extract stats from A record (positions 11-20 = organisme, 25-30 = date, 21-24 = fichier)
      const paddedA = line.padEnd(LINE_LENGTH, " ");
      organisme = paddedA.substring(10, 20).trim();
      dateCreation = paddedA.substring(24, 30);
      fichierNum = paddedA.substring(20, 24);
    } else if (type === "C") {
      recordCCount++;
      const result = validateRecordC(line, lineNum);
      records.push(result);
      // Accumulate amount (pos 28-37 = montant en cents)
      const paddedC = line.padEnd(LINE_LENGTH, " ");
      const amtStr = paddedC.substring(27, 37);
      if (isNumeric(amtStr)) {
        totalAmountCents += parseInt(amtStr, 10);
      }
    } else if (type === "Z") {
      recordZCount++;
      const result = validateRecordZ(line, lineNum, recordCCount, totalAmountCents);
      records.push(result);
    } else {
      globalErrors.push({
        field: `Ligne ${lineNum}`,
        position: "1",
        expected: "A, C ou Z",
        actual: type || "(vide)",
        severity: "error",
        message: `Ligne ${lineNum}: type d'enregistrement inconnu "${type || "(vide)"}"`,
      });
      records.push({
        lineNumber: lineNum,
        recordType: "UNKNOWN",
        label: `Ligne ${lineNum} — Type inconnu`,
        valid: false,
        errors: [
          {
            field: "Type",
            position: "1",
            expected: "A, C ou Z",
            actual: type || "(vide)",
            severity: "error",
            message: `Type inconnu: "${type || "(vide)"}"`,
          },
        ],
        fields: [],
      });
    }
  }

  // ── Pass 2: global structure checks ──
  if (recordACount === 0) {
    globalErrors.push({
      field: "Structure",
      position: "-",
      expected: "1 enregistrement A",
      actual: "0",
      severity: "error",
      message: "Enregistrement A (en-tête) manquant — fichier rejeté",
    });
  } else if (recordACount > 1) {
    globalErrors.push({
      field: "Structure",
      position: "-",
      expected: "1 enregistrement A",
      actual: String(recordACount),
      severity: "error",
      message: `${recordACount} enregistrements A trouvés — un seul est autorisé`,
    });
  }

  if (recordZCount === 0) {
    globalErrors.push({
      field: "Structure",
      position: "-",
      expected: "1 enregistrement Z",
      actual: "0",
      severity: "error",
      message: "Enregistrement Z (pied de fichier) manquant — fichier rejeté",
    });
  } else if (recordZCount > 1) {
    globalErrors.push({
      field: "Structure",
      position: "-",
      expected: "1 enregistrement Z",
      actual: String(recordZCount),
      severity: "error",
      message: `${recordZCount} enregistrements Z trouvés — un seul est autorisé`,
    });
  }

  if (recordCCount === 0) {
    globalErrors.push({
      field: "Structure",
      position: "-",
      expected: "au moins 1 enregistrement C",
      actual: "0",
      severity: "error",
      message: "Aucun enregistrement C (détail) trouvé",
    });
  }

  // Check A is first, Z is last
  if (records.length > 0) {
    if (records[0].recordType !== "A") {
      globalErrors.push({
        field: "Structure",
        position: "Ligne 1",
        expected: "Enregistrement A",
        actual: records[0].recordType,
        severity: "error",
        message: "Le premier enregistrement doit être de type A",
      });
    }
    if (records[records.length - 1].recordType !== "Z") {
      globalErrors.push({
        field: "Structure",
        position: `Ligne ${records.length}`,
        expected: "Enregistrement Z",
        actual: records[records.length - 1].recordType,
        severity: "error",
        message: "Le dernier enregistrement doit être de type Z",
      });
    }
  }

  const totalErrors = globalErrors.filter((e) => e.severity === "error").length +
    records.reduce((sum, r) => sum + r.errors.filter((e) => e.severity === "error").length, 0);
  const totalWarnings = globalErrors.filter((e) => e.severity === "warning").length +
    records.reduce((sum, r) => sum + r.errors.filter((e) => e.severity === "warning").length, 0);

  return {
    valid: totalErrors === 0,
    totalLines: lines.length,
    recordA: recordACount,
    recordC: recordCCount,
    recordZ: recordZCount,
    totalErrors,
    totalWarnings,
    records,
    globalErrors,
    stats: {
      totalAmount: totalAmountCents,
      transactionCount: recordCCount,
      organisme,
      dateCreation,
      fichierNum,
    },
  };
}

// ─── Utility: Format Julian date 0AAJJJ to human-readable ───────────────────
// Input: "025349" → Output: "15 décembre 2025 (jour 349)"
export function formatJulianDate(julian: string): string {
  if (!julian || julian.length !== 6) return julian;
  const year = 2000 + parseInt(julian.substring(1, 3), 10);
  const day = parseInt(julian.substring(3, 6), 10);
  if (isNaN(year) || isNaN(day) || day < 1 || day > 366) return julian;
  const date = new Date(year, 0, day);
  const formatted = date.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${formatted} (jour ${day})`;
}
