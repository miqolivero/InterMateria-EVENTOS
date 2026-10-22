import dayjs from "dayjs";

export const fechaAPI = (fecha) => fecha ? dayjs(fecha).format("YYYY-MM-DD") : null;
export const sinFechasPasadas = (fecha) => fecha && fecha.isBefore(dayjs().startOf("day"), "day");
export const opcionesActivos = (lista, id, etiqueta = "nombre", seleccionado) => (lista || [])
  .filter((item) => item.activo || item[id] === seleccionado)
  .map((item) => ({ value: item[id], label: (typeof etiqueta === "function" ? etiqueta(item) : item[etiqueta]) + (item.activo ? "" : " (inactivo)"), disabled: !item.activo }));
export const nombreCompleto = (persona) => persona ? `${persona.nombre || ""} ${persona.apellido === "-" ? "" : persona.apellido || ""}`.trim() : "—";

// Una lista blanca evita enviar estados, importes calculados o id_empresa recibidos del servidor.
export function camposPermitidos(datos, campos) {
  return Object.fromEntries(campos.map((campo) => [campo, typeof datos[campo] === "string" ? datos[campo].trim() : datos[campo] ?? null]));
}
