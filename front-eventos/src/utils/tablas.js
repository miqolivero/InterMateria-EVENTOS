// Para tocar el encabezado de una columna de fecha y ordenar la tabla. Las fechas
// llegan de la API en formato ISO: como texto, ya quedan en orden cronológico.
export const ordenFecha = (campo) => ({
  sorter: (a, b) => String(a[campo] ?? "").localeCompare(String(b[campo] ?? ""))
});
