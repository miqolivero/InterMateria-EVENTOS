import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, App, Button, Form, Input, Typography } from "antd";
import { ArrowLeftOutlined, KeyOutlined, LockOutlined } from "@ant-design/icons";
import { cambiarPassword } from "../servicios/authService";
import { useSesion } from "../contexto/useSesion";
import { mensajeError } from "../utils/errores";
import { inicioDeRol } from "../utils/menu";
import MarcoAcceso from "../componentes/MarcoAcceso";

// Cambio de la propia contraseña (Fase 10). Es obligatoria si la contraseña
// la puso otra persona (alta o reset): en ese caso RutaProtegida no deja ver
// ninguna otra pantalla hasta cambiarla, y acá no hay botón para volver.
export default function CambiarPassword() {
  const { usuario, actualizarUsuario, salir } = useSesion();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const obligatoria = usuario.debe_cambiar_password;

  async function guardar({ password_actual, password_nueva }) {
    if (enviando) return;
    setError(""); setEnviando(true);
    try {
      await cambiarPassword(password_actual, password_nueva);
      actualizarUsuario({ debe_cambiar_password: false });
      message.success("Contraseña actualizada.");
      navigate(inicioDeRol(usuario.rol), { replace: true });
    } catch (err) {
      setError(mensajeError(err, "No se pudo cambiar la contraseña."));
    } finally { setEnviando(false); }
  }

  return <MarcoAcceso pie={obligatoria
    ? <Button type="link" onClick={() => { salir(); navigate("/login", { replace: true }); }}>Cerrar sesión</Button>
    : <Link className="acceso-volver" to={inicioDeRol(usuario.rol)}><ArrowLeftOutlined /> Volver</Link>}>
    <Typography.Title level={2}>Cambiar contraseña</Typography.Title>
    {obligatoria && <Alert type="info" showIcon className="aviso-formulario"
      title="Tu contraseña la creó otra persona."
      description="Elegí una nueva para seguir. Solo vos la vas a conocer." />}
    {error && <Alert type="error" title={error} showIcon role="alert" className="aviso-formulario" />}
    <Form layout="vertical" onFinish={guardar} requiredMark={false} disabled={enviando}>
      {/* Campo oculto para que el gestor de contraseñas sepa de qué cuenta es */}
      <input type="email" name="email" value={usuario.email} autoComplete="username" readOnly hidden />
      <Form.Item name="password_actual" label={obligatoria ? "Contraseña que te dieron" : "Contraseña actual"}
        rules={[{ required: true, message: "Ingresá tu contraseña actual." }]}>
        <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
      </Form.Item>
      <Form.Item name="password_nueva" label="Contraseña nueva" hasFeedback
        rules={[{ required: true, message: "Ingresá la contraseña nueva." }, { min: 6, message: "Tiene que tener al menos 6 caracteres." },
          ({ getFieldValue }) => ({ validator: (_, valor) => !valor || valor !== getFieldValue("password_actual")
            ? Promise.resolve() : Promise.reject(new Error("Tiene que ser distinta de la actual.")) })]}>
        <Input.Password prefix={<KeyOutlined />} autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="confirmacion" label="Repetí la contraseña nueva" dependencies={["password_nueva"]} hasFeedback
        rules={[{ required: true, message: "Repetí la contraseña nueva." },
          ({ getFieldValue }) => ({ validator: (_, valor) => !valor || valor === getFieldValue("password_nueva")
            ? Promise.resolve() : Promise.reject(new Error("Las contraseñas no coinciden.")) })]}>
        <Input.Password prefix={<KeyOutlined />} autoComplete="new-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={enviando}>Guardar contraseña</Button>
    </Form>
  </MarcoAcceso>;
}
