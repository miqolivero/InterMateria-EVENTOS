import { Col, Form, Input, Row } from "antd";

// Los campos de una empresa. Los usan el alta de empresa (dentro del bloque
// "empresa" del body), la edición del superadmin y "Mi empresa".
// grupo: el prefijo del nombre en el Form (["empresa", "nombre"] en el alta).
// cuitEditable: false en Mi empresa, donde el cuit solo lo cambia el superadmin.
export default function CamposEmpresa({ grupo, cuitEditable = true }) {
  const nombre = (campo) => grupo ? [grupo, campo] : campo;
  return <Row gutter={16}>
    <Col xs={24} sm={12}><Form.Item name={nombre("nombre")} label="Nombre" rules={[{ required: true, whitespace: true, message: "Completá el nombre." }, { max: 150 }]}>
      <Input maxLength={150} /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name={nombre("cuit")} label="CUIT"
      extra={cuitEditable ? undefined : "El CUIT solo lo puede corregir el administrador del sistema."}
      rules={cuitEditable ? [{ required: true, whitespace: true, message: "Completá el CUIT." }, { max: 13 }] : []}>
      <Input maxLength={13} disabled={!cuitEditable} placeholder="30-12345678-9" /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name={nombre("email")} label="Email" rules={[{ type: "email", message: "Email inválido." }, { max: 150 }]}>
      <Input type="email" maxLength={150} /></Form.Item></Col>
    <Col xs={24} sm={12}><Form.Item name={nombre("telefono")} label="Teléfono" rules={[{ max: 30 }]}>
      <Input type="tel" maxLength={30} /></Form.Item></Col>
    <Col xs={24}><Form.Item name={nombre("direccion")} label="Dirección" rules={[{ max: 200 }]}>
      <Input maxLength={200} /></Form.Item></Col>
  </Row>;
}

