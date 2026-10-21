import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, App, Button, Card, Empty, Input, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { ApartmentOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { obtenerEmpresas, eliminarEmpresa } from "../servicios/empresasService";
import { useSesion } from "../contexto/useSesion";
import { mensajeError } from "../utils/errores";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import { useConsulta } from "../contexto/useConsulta";

const consultarEmpresas = async () => (await obtenerEmpresas()).data;

export default function Empresas({ publico = false }) {
  const { usuario } = useSesion();
  const { message } = App.useApp();
  const { datos, cargando, error: errorConsulta, recargar } = useConsulta(consultarEmpresas);
  const empresas = useMemo(() => datos || [], [datos]);
  const error = errorConsulta ? mensajeError(errorConsulta, "No se pudieron cargar las empresas.") : "";
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todas");
  const [eliminando, setEliminando] = useState(null);
  const esAdmin = usuario?.rol === "admin";


  const filtradas = useMemo(() => empresas.filter((empresa) => {
    const coincide = `${empresa.nombre} ${empresa.cuit} ${empresa.email || ""}`.toLocaleLowerCase("es").includes(busqueda.toLocaleLowerCase("es").trim());
    return coincide && (estado === "todas" || empresa.activo === (estado === "activas"));
  }), [empresas, busqueda, estado]);

  async function eliminar(empresa) {
    setEliminando(empresa.id_empresa);
    try {
      await eliminarEmpresa(empresa.id_empresa);
      recargar();
      message.success("Empresa eliminada.");
    } catch (err) { message.error(mensajeError(err, "No se pudo eliminar la empresa.")); }
    finally { setEliminando(null); }
  }

  const columnas = [
    { title: "Empresa", dataIndex: "nombre", key: "nombre", sorter: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
      render: (nombre) => <Typography.Text strong>{nombre}</Typography.Text> },
    { title: "CUIT", dataIndex: "cuit", key: "cuit" },
    { title: "Contacto", key: "contacto", render: (_, e) => <><div>{e.email || "Sin email"}</div><span className="texto-secundario">{e.telefono || "Sin teléfono"}</span></> },
    { title: "Estado", dataIndex: "activo", key: "activo", render: (activo) => <Tag color={activo ? "green" : "default"}>{activo ? "Activa" : "Inactiva"}</Tag> }
  ];
  if (esAdmin) columnas.push({ title: "Acciones", key: "acciones", width: 210, render: (_, empresa) => <Space>
    <Link to={`/empresas/${empresa.id_empresa}/editar`}><Button type="text" icon={<EditOutlined />} aria-label={`Editar ${empresa.nombre}`}>Editar</Button></Link>
    <Popconfirm title={`¿Eliminar ${empresa.nombre}?`} description="Esta acción elimina el registro de la empresa."
      okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => eliminar(empresa)}>
      <Button type="text" danger icon={<DeleteOutlined />} loading={eliminando === empresa.id_empresa}
        disabled={eliminando !== null && eliminando !== empresa.id_empresa} aria-label={`Eliminar ${empresa.nombre}`} />
    </Popconfirm>
  </Space> });

  return <div className={publico ? "pagina-publica" : ""}>
    {publico && <header className="cabecera-publica"><Link className="marca-publica" to="/"><ApartmentOutlined /> eventos</Link>
      <Space><Link to="/login"><Button>Iniciar sesión</Button></Link><Link to="/registro"><Button type="primary">Crear cuenta</Button></Link></Space></header>}
    <EncabezadoPagina titulo="Empresas"
      acciones={esAdmin && <Link to="/empresas/nueva"><Button type="primary" icon={<PlusOutlined />}>Nueva empresa</Button></Link>} />
    {publico && <Alert className="aviso-formulario" type="info" showIcon title="Iniciá sesión para gestionar tu empresa." />}
    {error && <Alert className="aviso-formulario" type="error" showIcon title={error}
      action={<Button onClick={recargar} size="small">Reintentar</Button>} />}
    <Card className="panel-tabla">
      <div className="barra-tabla"><Input placeholder="Buscar por nombre, CUIT o email" prefix={<SearchOutlined />} allowClear value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar empresas" style={{ maxWidth: 360 }} />
        <Space wrap><Select value={estado} onChange={setEstado} aria-label="Filtrar por estado" style={{ minWidth: 160 }}
          options={[{ value: "todas", label: "Todos los estados" }, { value: "activas", label: "Activas" }, { value: "inactivas", label: "Inactivas" }]} />
          <Button icon={<ReloadOutlined />} onClick={recargar} loading={cargando} aria-label="Actualizar empresas" /></Space>
      </div>
      <Table rowKey="id_empresa" columns={columnas} dataSource={filtradas} loading={cargando}
        scroll={{ x: 760 }} pagination={{ pageSize: 8, hideOnSinglePage: true, showTotal: (total) => `${total} empresas` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "No se pudo obtener el listado" : empresas.length ? "No hay coincidencias con estos filtros" : "Todavía no hay empresas registradas"} /> }} />
      <div className="pie-tabla">{filtradas.length} {filtradas.length === 1 ? "empresa" : "empresas"}</div>
    </Card>
  </div>;
}
