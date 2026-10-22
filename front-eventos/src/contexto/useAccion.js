import { useRef, useState } from "react";
import { App } from "antd";
import { mensajeError } from "../utils/errores.js";

export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const { message } = App.useApp();
  async function ejecutar(operacion, exito = "Cambios guardados.") {
    if (bloqueo.current) return { ok: false };
    bloqueo.current = true; setOcupado(true);
    try {
      const respuesta = await operacion();
      if (exito) message.success(exito);
      return { ok: true, datos: respuesta?.data };
    } catch (error) {
      message.error(mensajeError(error));
      return { ok: false };
    } finally { bloqueo.current = false; setOcupado(false); }
  }
  return { ocupado, ejecutar };
}
