import { useState } from "react";

// Los filtros de un listado y cómo volver a verlo todo. base: los valores que no
// cuentan como filtro (por ejemplo, "Activos" en un catálogo).
// clave: va en la key de la barra de filtros. Al limpiar cambia y la barra se vuelve
// a armar, con lo que también se vacían la búsqueda y las fechas.
export function useFiltros(inicial = {}, base = {}) {
  const [filtros, setFiltros] = useState(inicial);
  const [clave, setClave] = useState(0);
  const filtrar = (campo, valor) => setFiltros((actual) => ({ ...actual, [campo]: valor ?? undefined }));
  const limpiar = () => { setFiltros(base); setClave((c) => c + 1); };
  const hayFiltros = Object.entries(filtros).some(([campo, valor]) => valor !== undefined && valor !== null && valor !== "" && valor !== base[campo]);
  return { filtros, setFiltros, filtrar, limpiar, hayFiltros, clave };
}
