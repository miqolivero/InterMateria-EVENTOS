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

// El lugar del evento en un formulario: un salón del catálogo o uno que reservó el
// cliente por su cuenta, que se guarda como texto y sin id_sede.
export const lugarInicial = (datos) => {
  const texto = datos.sede_acordada ?? datos.sede_prevista;
  return !datos.id_sede && texto ? { tipo_lugar: "cliente", id_sede: null, lugar_externo: texto }
    : { tipo_lugar: "catalogo", id_sede: datos.id_sede ?? null, lugar_externo: null };
};

export const lugarDelForm = (v) => v?.tipo_lugar === "cliente"
  ? { id_sede: null, lugar_externo: v.lugar_externo?.trim() || null }
  : { id_sede: v?.id_sede ?? null, lugar_externo: null };

// Quién se puede elegir como coordinador de un evento. La API lo vuelve a controlar.
export const puedeCoordinar = (empleado) => Boolean(empleado.acceso?.activo) && ["admin", "coordinador"].includes(empleado.acceso.rol);
