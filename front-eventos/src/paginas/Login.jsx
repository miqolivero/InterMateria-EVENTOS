import { useState } from "react";
import { useNavigate, Link, useLocation, Navigate } from "react-router-dom";
import { Alert, Button, Form, Input, Typography } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { login } from "../servicios/authService";
import { useSesion } from "../contexto/useSesion";
import { mensajeError } from "../utils/errores";
import MarcoAcceso from "../componentes/MarcoAcceso";

function Login() {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, iniciarSesion } = useSesion();

  const manejarEnvio = async (form) => {
    if (enviando) return;
    setError("");
    setEnviando(true);

    try {
      const respuesta = await login(form.email.trim(), form.password);
      iniciarSesion(respuesta.data);
      const desde = location.state?.desde;
      navigate(typeof desde === "string" && desde.startsWith("/") && !desde.startsWith("//") ? desde : "/seguimiento", { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesión."));
    } finally {
      setEnviando(false);
    }
  };

  if (usuario) return <Navigate to="/seguimiento" replace />;
  return <MarcoAcceso>
    <Typography.Title level={2}>Iniciar sesión</Typography.Title>
    {location.state?.registroExitoso && <Alert type="success" title="Cuenta creada. Ya podés iniciar sesión." showIcon className="aviso-formulario" />}
    {error && <Alert type="error" title={error} showIcon role="alert" className="aviso-formulario" />}
    <Form layout="vertical" onFinish={manejarEnvio} requiredMark={false} disabled={enviando}>
      <Form.Item name="email" label="Email" rules={[{ required: true, message: "Ingresá tu email." }, { type: "email", message: "Ingresá un email válido." }]}>
        <Input prefix={<MailOutlined />} autoComplete="username" placeholder="nombre@empresa.com" type="email" />
      </Form.Item>
      <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: "Ingresá tu contraseña." }]}>
        <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="Tu contraseña" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={enviando} icon={<ArrowRightOutlined />} iconPlacement="end">Ingresar</Button>
    </Form>
    <p className="acceso-enlace">¿Todavía no tenés una cuenta? <Link to="/registro">Crear cuenta</Link></p>
  </MarcoAcceso>;
}

export default Login;
