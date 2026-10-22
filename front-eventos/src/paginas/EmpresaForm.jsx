import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, App, Button, Card, Col, Form, Input, Row, Skeleton, Space, Switch } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { obtenerEmpresa, crearEmpresa, actualizarEmpresa } from "../servicios/empresasService";
import { mensajeError } from "../utils/errores";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import { useConsulta } from "../contexto/useConsulta";

const vacia = { nombre: "", cuit: "", email: "", telefono: "", direccion: "", activo: true };

export default function EmpresaForm() {
  const { id } = useParams();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const consultar = useCallback(async () => id ? (await obtenerEmpresa(id)).data : vacia, [id]);
  const { datos, cargando, error: errorConsulta, recargar } = useConsulta(consultar);
  const falloCarga = Boolean(errorConsulta);

  useEffect(() => {
    if (datos && !cargando) form.setFieldsValue(Object.fromEntries(Object.keys(vacia).map((key) => [key, datos[key] ?? ""])));
  }, [datos, cargando, form]);

  async function guardar(datos) {
    if (guardando) return;
    setGuardando(true); setError("");
    const empresa = Object.fromEntries(Object.entries(datos).map(([key, valor]) => [key, typeof valor === "string" ? valor.trim() : valor]));
    if (!id) delete empresa.activo;
    try {
      if (id) await actualizarEmpresa(id, empresa); else await crearEmpresa(empresa);
      message.success(id ? "Empresa actualizada." : "Empresa creada.");
      navigate("/empresas");
    } catch (err) { setError(mensajeError(err, "No se pudo guardar la empresa.")); }
    finally { setGuardando(false); }
  }

  return <>
    <Link className="enlace-volver" to="/empresas"><ArrowLeftOutlined /> Volver a empresas</Link>
    <EncabezadoPagina etiqueta="ORGANIZADORAS" titulo={id ? "Editar empresa" : "Nueva empresa"}
      descripcion="Datos de identificación y contacto de la organizadora." />
    <Card className="panel-formulario">
      {(error || falloCarga) && <Alert className="aviso-formulario" type="error" showIcon role="alert" title={error || mensajeError(errorConsulta, "No se pudo cargar la empresa.")}
        action={falloCarga && <Button size="small" onClick={recargar}>Reintentar</Button>} />}
      {cargando ? <Skeleton active paragraph={{ rows: 8 }} /> : !falloCarga &&
        <Form form={form} initialValues={vacia} layout="vertical" onFinish={guardar} disabled={guardando}>
          <Row gutter={24}>
            <Col xs={24} md={14}><Form.Item name="nombre" label="Nombre de la empresa" rules={[{ required: true, whitespace: true, message: "Ingresá el nombre de la empresa." }, { max: 150 }]}>
              <Input placeholder="Ej. Eventos del Centro" maxLength={150} autoComplete="organization" />
            </Form.Item></Col>
            <Col xs={24} md={10}><Form.Item name="cuit" label="CUIT" rules={[{ required: true, whitespace: true, message: "Ingresá el CUIT." }, { max: 13 }]}>
              <Input placeholder="30-12345678-9" maxLength={13} />
            </Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="email" label="Email de contacto" rules={[{ type: "email", message: "Ingresá un email válido." }, { max: 150 }]}>
              <Input type="email" placeholder="contacto@empresa.com" maxLength={150} autoComplete="email" />
            </Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="telefono" label="Teléfono" rules={[{ max: 30 }]}>
              <Input type="tel" placeholder="Ej. 351 4001122" maxLength={30} autoComplete="tel" />
            </Form.Item></Col>
            <Col span={24}><Form.Item name="direccion" label="Dirección" rules={[{ max: 200 }]}>
              <Input placeholder="Calle, número y localidad" maxLength={200} autoComplete="street-address" />
            </Form.Item></Col>
          </Row>
          {id && <Form.Item name="activo" label="Empresa activa" valuePropName="checked"><Switch /></Form.Item>}
          <div className="acciones-formulario"><Space><Button type="primary" htmlType="submit" loading={guardando} icon={<SaveOutlined />}>Guardar empresa</Button>
            <Link to="/empresas"><Button disabled={guardando}>Cancelar</Button></Link></Space></div>
        </Form>}
    </Card>
  </>;
}
