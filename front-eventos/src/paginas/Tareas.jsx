import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Card, Select, Space, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { listarEventos, todasLasTareas } from "../servicios/operacionService.js";
import { listarCatalogo } from "../servicios/catalogosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useFiltros } from "../contexto/useFiltros.js";
import { nombreCompleto } from "../utils/formularios.js";
import { formatearFecha } from "../utils/formato.js";
import { opcionesEstadoTarea } from "../utils/estados.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import LimpiarFiltros from "../componentes/LimpiarFiltros";
import { TablaTareas } from "../componentes/TareasEvento";

// El filtro de estado, como lo espera la API. Son parámetros distintos porque
// "vencida" y "no realizada" se calculan.
const filtroDeEstado = (estado) => estado === "sin_realizar" ? { sin_realizar: true } : estado === "vencida" ? { vencidas: true }
  : estado === "sin_completar" ? { sin_completar: true } : estado ? { estado_tarea: estado } : {};

// Y al revés: qué opción mostrar en el select cuando la barra se vuelve a armar.
const estadoDeFiltros = (f) => f.sin_realizar ? "sin_realizar" : f.vencidas ? "vencida" : f.sin_completar ? "sin_completar" : f.estado_tarea;

// Todas las tareas de la empresa, de todos los eventos y responsables, para
// organizar el trabajo sin entrar evento por evento (admin y coordinador).
// Editar o borrar una tarea se hace desde su evento; acá se cambia el estado.
export default function Tareas() {
  // Desde una tarjeta de Seguimiento se entra con el filtro y los días en la URL
  const [parametros] = useSearchParams();
  const estadoInicial = opcionesEstadoTarea({ conVencida: true }).some((o) => o.value === parametros.get("estado")) ? parametros.get("estado") : undefined;
  const diasIniciales = Number(parametros.get("dias")) || undefined;
  const { filtros, setFiltros, filtrar, limpiar, hayFiltros, clave } = useFiltros({ ...filtroDeEstado(estadoInicial), dias: diasIniciales });
  const consulta = useConsulta(useCallback(async () => (await todasLasTareas(filtros)).data, [filtros]));
  const eventos = useConsulta(useCallback(async () => (await listarEventos()).data, []));
  const empleados = useConsulta(useCallback(async () => (await listarCatalogo("empleados")).data, []));
  return <>
    <EncabezadoPagina titulo="Tareas" descripcion="Todas las tareas de la empresa." />
    {filtros.dias && <Alert type="info" showIcon closable className="aviso-formulario" onClose={() => filtrar("dias", undefined)}
      title={`Desde Seguimiento: eventos abiertos de los próximos ${filtros.dias === 365 ? "12 meses" : `${filtros.dias} días`} y los ya pasados sin cerrar. Cerrá este aviso para ver todas.`} />}
    <ErrorConsulta {...consulta} /><ErrorConsulta {...eventos} /><ErrorConsulta {...empleados} />
    <Card><div className="barra-tabla" key={clave}><Space wrap>
      <Select aria-label="Evento" placeholder="Todos los eventos" allowClear showSearch optionFilterProp="label" className="filtro-evento" loading={eventos.cargando}
        onChange={(v) => filtrar("id_evento", v)} options={(eventos.datos || []).map((e) => ({ value: e.id_evento,
          label: `${e.nombre_cliente} · ${e.nombre_tipo_evento} · ${formatearFecha(e.fecha_evento_confirmada)}` }))} />
      <Select aria-label="Responsable" placeholder="Todos los responsables" allowClear showSearch optionFilterProp="label" className="filtro-responsable" loading={empleados.cargando}
        onChange={(v) => filtrar("id_empleado_responsable", v)} options={(empleados.datos || []).map((e) => ({ value: e.id_empleado, label: nombreCompleto(e) }))} />
      <Select aria-label="Estado" placeholder="Todos los estados" allowClear className="filtro-estado-tarea" defaultValue={estadoDeFiltros(filtros)}
        onChange={(v) => setFiltros((f) => ({ ...f, estado_tarea: undefined, sin_realizar: undefined, vencidas: undefined, sin_completar: undefined, ...filtroDeEstado(v) }))}
        options={opcionesEstadoTarea({ conVencida: true })} />
      <LimpiarFiltros activo={hayFiltros} alTocar={limpiar} />
    </Space><Button icon={<ReloadOutlined />} aria-label="Actualizar" onClick={consulta.recargar} loading={consulta.cargando} /></div>
      <TablaTareas tareas={consulta.datos || []} mostrarEvento editable actualizar={consulta.recargar} paginar cargando={consulta.cargando} />
    </Card>
  </>;
}
