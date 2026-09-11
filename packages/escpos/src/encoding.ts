/**
 * Thermal printers do not speak UTF-8. Most Epson-compatible ESC/POS controllers
 * support CP850 (DOS Latin-1 / "Multilingual"), which covers French diacritics.
 * We map the common French letters explicitly; anything else is decomposed
 * (NFKD) and stripped of combining marks so the ticket stays readable instead
 * of printing garbage bytes.
 */
const CP850_MAP: Record<string, number> = {
  "é": 0x82, "â": 0x83, "à": 0x85, "å": 0x86, "ç": 0x87, "ê": 0x88, "ë": 0x89,
  "è": 0x8a, "ï": 0x8b, "î": 0x8c, "ì": 0x8d, "ä": 0x84, "Ä": 0x8e, "Å": 0x8f,
  "É": 0x90, "æ": 0x91, "Æ": 0x92, "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96,
  "ù": 0x97, "ÿ": 0x98, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "£": 0x9c, "Ø": 0x9d,
  "×": 0x9e, "ƒ": 0x9f, "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4,
  "Ñ": 0xa5, "ª": 0xa6, "º": 0xa7, "¿": 0xa8, "œ": 0x9c, "Œ": 0x9c, "ü": 0x81,
  "€": 0xd5,
};

// Unicode combining diacritical marks block (U+0300 - U+036F), produced by NFKD decomposition.
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Encodes text for printing on a CP850 thermal printer, byte per char. */
export function encodeCp850(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      bytes.push(code);
      continue;
    }
    const mapped = CP850_MAP[char];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    // Fallback: strip diacritics (e.g. accented char without a direct mapping) instead of printing garbage
    const stripped = char.normalize("NFKD").replace(COMBINING_MARKS, "");
    if (stripped && stripped.codePointAt(0)! < 0x80) {
      bytes.push(stripped.codePointAt(0)!);
    } else {
      bytes.push(0x3f); // "?"
    }
  }
  return bytes;
}
