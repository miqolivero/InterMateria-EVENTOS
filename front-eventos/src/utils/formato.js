import dayjs from "dayjs";

export const formatearMoneda = (valor) => valor == null ? "—" :
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(valor));

export const formatearFecha = (valor) => {
  if (!valor) return "—";
  const fecha = dayjs(valor);
  return fecha.isValid() ? fecha.format("DD/MM/YYYY") : "—";
};

// La cuenta regresiva de un evento. Los días los calcula la API.
export const textoDiasRestantes = (dias) => {
  if (dias === 0) return "Es hoy";
  if (dias === 1) return "Falta 1 día";
  return `Faltan ${dias} días`;
};

// Cuánto apura: hasta 7 días hay que estar encima, hasta 30 ya está cerca
export const urgenciaDias = (dias) => dias <= 7 ? "alta" : dias <= 30 ? "media" : "baja";
