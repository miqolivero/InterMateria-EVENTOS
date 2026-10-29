import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Alert, Button, Form, Input, Modal, Typography } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { leerAvisoSesion, login } from "../servicios/authService";
import { useSesion } from "../contexto/useSesion";
import { mensajeLogin } from "../utils/errores";
import { inicioDeRol, puedeEntrar } from "../utils/menu";
import MarcoAcceso from "../componentes/MarcoAcceso";

function Login() {
  const [error, setError] = useState("");
  // Motivo de un cierre de sesión forzado (por ejemplo, la empresa fue suspendida)
  const [aviso] = useState(leerAvisoSesion);
  const [enviando, setEnviando] = useState(false);
  const [ayuda, setAyuda] = useState(false);
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
      setError(mensajeLogin(err));
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
    <p className="acceso-enlace"><Button type="link" size="small" onClick={() => setAyuda(true)}>¿Olvidaste tu contraseña?</Button></p>
    <p className="acceso-enlace">¿No tenés cuenta? Pedísela al administrador de tu empresa.</p>
    {/* No hay recuperación por email: la contraseña la resetea alguien con
        permiso, y quien la recibe la tiene que cambiar al entrar */}
    <Modal open={ayuda} title="¿Olvidaste tu contraseña?" onCancel={() => setAyuda(false)} footer={<Button onClick={() => setAyuda(false)}>Entendido</Button>}>
      <Typography.Paragraph>Por seguridad, la contraseña no se recupera por email. La resetea alguien con permiso y te da una temporal, que vas a tener que cambiar al entrar:</Typography.Paragraph>
      <ul className="ayuda-password">
        <li><strong>Empleados y coordinadores:</strong> el administrador de tu empresa, desde Usuarios → Resetear contraseña.</li>
        <li><strong>Administradores de una empresa:</strong> el soporte del sistema, desde el panel de Empresas.</li>
        <li><strong>Soporte del sistema:</strong> desde el servidor, con <code>npm run usuario:password</code> (ver el README de la API).</li>
      </ul>
    </Modal>
  </MarcoAcceso>;
}

export default Login;
