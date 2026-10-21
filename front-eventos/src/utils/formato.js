import dayjs from "dayjs";

export const formatearMoneda = (valor) => valor == null ? "—" :
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(valor));

export const formatearFecha = (valor) => {
  if (!valor) return "—";
  const fecha = dayjs(valor);
  return fecha.isValid() ? fecha.format("DD/MM/YYYY") : "—";
};
