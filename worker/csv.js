// CSV sin dependencias: leer (comillas, saltos de línea dentro de comillas, BOM, separador , o ;)
// y escribir (compatible con Excel en español).

export function leerCsv(texto) {
  const t = texto.replace(/^﻿/, '');
  const primeraLinea = t.slice(0, t.search(/\r?\n|$/));
  // Excel en español suele guardar con ";": usar el que más aparezca en el encabezado.
  const sep = (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

// Una celda de texto que empieza con = + - @ podría ejecutarse como fórmula en Excel.
const segura = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function escribirCsv(encabezados, filas) {
  const celda = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(segura(v));
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM para que Excel lea bien los acentos.
  return `﻿${[encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n')}\r\n`;
}
