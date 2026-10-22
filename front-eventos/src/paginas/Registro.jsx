import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Alert, Button, Form, Input, Select, Typography } from "antd";
import { registrar } from "../servicios/authService";
import { obtenerEmpresas } from "../servicios/empresasService";
import { useSesion } from "../contexto/useSesion";
import { mensajeError } from "../utils/errores";
import MarcoAcceso from "../componentes/MarcoAcceso";
import { useConsulta } from "../contexto/useConsulta";

const consultarEmpresas = async () => (await obtenerEmpresas()).data.filter((empresa) => empresa.activo);

export default function Registro() {
  const { datos, cargando, error: errorConsulta, recargar } = useConsulta(consultarEmpresas);
  const empresas = useMemo(() => datos || [], [datos]);
  const errorCarga = errorConsulta ? mensajeError(errorConsulta, "No se pudieron cargar las empresas.") : "";
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const { usuario } = useSesion();
  const navigate = useNavigate();


  async function guardar(datos) {
    if (enviando) return;
    setEnviando(true); setError("");
    try {
      const { confirmar_password: _confirmacion, ...cuenta } = datos;
      await registrar({ ...cuenta, nombre: cuenta.nombre.trim(), email: cuenta.email.trim(), id_empresa: Number(cuenta.id_empresa) });
      navigate("/login", { replace: true, state: { registroExitoso: true } });
    } catch (err) { setError(mensajeError(err)); }
    finally { setEnviando(false); }
  }

  if (usuario) return <Navigate to="/seguimiento" replace />;
  return <MarcoAcceso>
    <Typography.Title level={2}>Crear cuenta</Typography.Title>
    {errorCarga && <Alert type="error" title={errorCarga} showIcon className="aviso-formulario"
      action={<Button size="small" onClick={recargar}>Reintentar</Button>} />}
    {!cargando && !errorCarga && empresas.length === 0 && <Alert type="info" showIcon className="aviso-formulario"
      title="Todavía no hay empresas activas" description="Pedile a un administrador que dé de alta tu empresa para poder registrarte." />}
    {error && <Alert type="error" title={error} role="alert" showIcon className="aviso-formulario" />}
    <Form layout="vertical" onFinish={guardar} requiredMark={false} disabled={enviando}>
      <Form.Item label="Nombre completo" name="nombre" rules={[{ required: true, whitespace: true, message: "Ingresá tu nombre." }, { max: 100 }]}>
        <Input autoComplete="name" placeholder="Tu nombre y apellido" maxLength={100} />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={[{ required: true, message: "Ingresá tu email." }, { type: "email", message: "Ingresá un email válido." }, { max: 150 }]}>
        <Input type="email" autoComplete="email" placeholder="nombre@empresa.com" maxLength={150} />
      </Form.Item>
      <Form.Item label="Empresa" name="id_empresa" rules={[{ required: true, message: "Seleccioná tu empresa." }]}>
        <Select placeholder="Seleccioná una empresa" loading={cargando} disabled={cargando || Boolean(errorCarga) || empresas.length === 0 || enviando}
          showSearch optionFilterProp="label" options={empresas.map((e) => ({ value: e.id_empresa, label: e.nombre }))} />
      </Form.Item>
      <Form.Item label="Contraseña" name="password" rules={[{ required: true, message: "Ingresá una contraseña." },
        { validator: (_, valor) => !valor || new TextEncoder().encode(valor).length <= 72 ? Promise.resolve() : Promise.reject(new Error("Usá una contraseña de hasta 72 bytes.")) }]}>
        <Input.Password autoComplete="new-password" placeholder="Creá tu contraseña" />
      </Form.Item>
      <Form.Item label="Confirmar contraseña" name="confirmar_password" dependencies={["password"]}
        rules={[{ required: true, message: "Repetí tu contraseña." }, ({ getFieldValue }) => ({
          validator: (_, valor) => !valor || getFieldValue("password") === valor ? Promise.resolve() : Promise.reject(new Error("Las contraseñas no coinciden."))
        })]}>
        <Input.Password autoComplete="new-password" placeholder="Repetí tu contraseña" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={enviando} disabled={cargando || Boolean(errorCarga) || empresas.length === 0}>Crear mi cuenta</Button>
    </Form>
    <p className="acceso-enlace">¿Ya tenés una cuenta? <Link to="/login">Iniciar sesión</Link></p>
  </MarcoAcceso>;
}
