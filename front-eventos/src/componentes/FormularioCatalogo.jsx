import { useEffect } from "react";
import { Col, DatePicker, Form, Input, Row } from "antd";
import dayjs from "dayjs";
import { catalogos } from "../utils/catalogos.js";

export default function FormularioCatalogo({ recurso, datos, form, guardar, ocupado }) {
  const { campos } = catalogos[recurso];
  useEffect(() => {
    form.resetFields();
    form.setFieldsValue(Object.fromEntries(campos.map(([nombre, , , , tipo]) => [nombre,
      tipo === "fecha" ? datos?.[nombre] ? dayjs(datos[nombre]) : dayjs() : datos?.[nombre] ?? ""])));
  }, [datos, campos, form]);
  return <Form form={form} layout="vertical" disabled={ocupado} onFinish={guardar}>
    <Row gutter={16}>{campos.map(([nombre, etiqueta, max, requerido, tipo]) => <Col xs={24} sm={tipo === "fecha" || ["descripcion", "observaciones", "direccion"].includes(nombre) ? 24 : 12} key={nombre}>
      <Form.Item name={nombre} label={etiqueta} rules={[
        ...(requerido ? [{ required: true, whitespace: true, message: `Completá ${etiqueta.toLowerCase()}.` }] : []),
        ...(max ? [{ max }] : []), ...(nombre === "email" ? [{ type: "email", message: "Email inválido." }] : [])
      ]}>
        {tipo === "fecha" ? <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" allowClear={false} /> :
          ["descripcion", "observaciones"].includes(nombre) ? <Input.TextArea rows={3} maxLength={max} /> :
            <Input maxLength={max} type={nombre === "email" ? "email" : nombre === "telefono" ? "tel" : "text"} />}
      </Form.Item>
    </Col>)}</Row>
  </Form>;
}
