import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Alert, Button, Form, Input, Typography } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { leerAvisoSesion, login } from "../servicios/authService";
import { useSesion } from "../contexto/useSesion";
import { mensajeError } from "../utils/errores";
import { inicioDeRol, puedeEntrar } from "../utils/menu";
import MarcoAcceso from "../componentes/MarcoAcceso";

function Login() {
  const [error, setError] = useState("");
  // Motivo de un cierre de sesión forzado (por ejemplo, la empresa fue suspendida)
  const [aviso] = useState(leerAvisoSesion);
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
      // Vuelve a la pantalla que se pidió, si es de su rol; si no, a su inicio.
      // Si tiene que cambiar la contraseña, RutaProtegida lo manda primero ahí.
      const { rol } = respuesta.data.usuario;
      const desde = location.state?.desde;
      const valida = typeof desde === "string" && desde.startsWith("/") && !desde.startsWith("//") && puedeEntrar(rol, desde.split(/[?#]/)[0]);
      navigate(valida ? desde : inicioDeRol(rol), { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesión."));
    } finally {
      setEnviando(false);
    }
  };

  if (usuario) return <Navigate to={inicioDeRol(usuario.rol)} replace />;
  return <MarcoAcceso>
    <Typography.Title level={2}>Iniciar sesión</Typography.Title>
    {aviso && !error && <Alert type="warning" title={aviso} showIcon className="aviso-formulario" />}
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
    <p className="acceso-enlace">¿No tenés cuenta? Pedísela al administrador de tu empresa.</p>
  </MarcoAcceso>;
}

export default Login;
