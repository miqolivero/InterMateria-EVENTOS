// Validaciones de formato que comparten varios controladores. Se chequean
// antes de mandar el dato a la base: si no, un "abc" donde va un numero hace
// fallar el cast de PostgreSQL y terminaria en un 500 en vez de un 400.

// Un id valido es un entero positivo
export const esIdValido = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;

// Entero mayor a 0 (cantidades, dias de validez). Acepta tambien el numero
// como string ("80"), que es como llega si el front lo manda desde un input.
export const esEnteroPositivo = (valor) =>
  valor !== "" && valor !== null && Number.isInteger(Number(valor)) && Number(valor) > 0;

// Importe valido: un numero (o un string numerico) mayor o igual a 0. Se
// filtran a mano los tipos porque Number(true) da 1 y Number("") da 0, y
// ninguno de los dos es un importe.
export const esImporteValido = (valor) => {
  const esNumerico =
    typeof valor === "number" ||
    (typeof valor === "string" && valor.trim() !== "");

  return esNumerico && Number.isFinite(Number(valor)) && Number(valor) >= 0;
};

// Fecha con formato YYYY-MM-DD y que exista en el calendario (2026-02-31 no).
// Se compara contra lo que devuelve toISOString porque Date "corrige" las
// fechas imposibles en vez de fallar (el 31 de febrero pasa a ser 3 de marzo).
export const esFechaValida = (valor) => {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);
  return !isNaN(fecha) && fecha.toISOString().slice(0, 10) === valor;
};

// Un campo opcional que "no vino": undefined, null o string vacio. Se usa en
// vez de !valor porque 0 y false son valores validos.
export const esVacio = (valor) =>
  valor === undefined || valor === null || valor === "";
