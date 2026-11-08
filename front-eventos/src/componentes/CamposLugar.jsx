import { Form, Input, Radio, Select } from "antd";
import { opcionesActivos } from "../utils/formularios.js";

// Dónde se hace el evento: un salón del catálogo o uno que reservó el cliente. Va
// dentro de un Form con los valores de lugarInicial.
export default function CamposLugar({ sedes, cargando, etiqueta, ayuda, idActual }) {
  const form = Form.useFormInstance();
  const tipo = Form.useWatch("tipo_lugar", form);
  return <>
    <Form.Item name="tipo_lugar" label="¿Quién consigue el salón?">
      <Radio.Group options={[{ value: "catalogo", label: "Nosotros" }, { value: "cliente", label: "Ya lo tiene el cliente" }]} />
    </Form.Item>
    {tipo === "cliente"
      ? <Form.Item name="lugar_externo" label="Salón o dirección" extra="Queda solo como dato: no ocupa un salón de los nuestros."
        rules={[{ required: true, whitespace: true, message: "Escribí dónde se hace el evento." }]}>
        <Input maxLength={200} placeholder="Por ejemplo: Salón Los Álamos, Av. Colón 1500" /></Form.Item>
      : <Form.Item name="id_sede" label={etiqueta} extra={ayuda}>
        <Select allowClear showSearch optionFilterProp="label" placeholder="A definir" loading={cargando} notFoundContent="No hay sedes cargadas"
          options={opcionesActivos(sedes, "id_sede", "nombre", idActual)} /></Form.Item>}
  </>;
}
