import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Form, Modal } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { editarMiEmpresa, obtenerMiEmpresa } from "../servicios/usuariosService.js";
import { useConsulta } from "../contexto/useConsulta.js";
import { useAccion } from "../contexto/useAccion.js";
import { useSesion } from "../contexto/useSesion.js";
import { ADMIN } from "../utils/menu";
import { formatearFecha } from "../utils/formato.js";
import EncabezadoPagina from "../componentes/EncabezadoPagina";
import ErrorConsulta from "../componentes/ErrorConsulta";
import CamposEmpresa from "../componentes/CamposEmpresa";
import { datosEmpresa } from "../utils/usuarios.js";

function EditorMiEmpresa({ empresa, cerrar, guardada }) {
  const [form] = Form.useForm();
  const { ocupado, ejecutar } = useAccion();
  useEffect(() => { form.setFieldsValue(empresa); }, [empresa, form]);
  return <Modal open title="Editar mi empresa" okText="Guardar" cancelText="Cancelar" width={640} destroyOnHidden
    onCancel={ocupado ? undefined : cerrar} onOk={() => form.submit()} confirmLoading={ocupado}>
    <Form form={form} layout="vertical" disabled={ocupado} onFinish={async (valores) => {
      // El cuit no se manda: lo cambia solo el superadmin
      const { nombre, email, telefono, direccion } = datosEmpresa(valores);
      const r = await ejecutar(() => editarMiEmpresa({ nombre, email, telefono, direccion }));
      if (r.ok) { cerrar(); guardada(r.datos); }
    }}><CamposEmpresa cuitEditable={false} /></Form>
  </Modal>;
}

// Los datos de la empresa del usuario. Todos la ven; solo el admin la edita.
export default function MiEmpresa() {
  const { usuario, actualizarUsuario } = useSesion();
  const consulta = useConsulta(useCallback(async () => (await obtenerMiEmpresa()).data, []));
  const [editor, setEditor] = useState(false);
  const empresa = consulta.datos;
  return <>
    <EncabezadoPagina titulo="Mi empresa" acciones={usuario.rol === ADMIN && empresa &&
      <Button icon={<EditOutlined />} onClick={() => setEditor(true)}>Editar</Button>} />
    <ErrorConsulta {...consulta} />
    <Card loading={consulta.cargando}>
      {empresa && <Descriptions column={{ xs: 1, sm: 2 }} items={[
        { key: "nombre", label: "Nombre", children: empresa.nombre },
        { key: "cuit", label: "CUIT", children: empresa.cuit },
        { key: "email", label: "Email", children: empresa.email ? <a href={`mailto:${empresa.email}`}>{empresa.email}</a> : "—" },
        { key: "telefono", label: "Teléfono", children: empresa.telefono ? <a href={`tel:${empresa.telefono}`}>{empresa.telefono}</a> : "—" },
        { key: "direccion", label: "Dirección", children: empresa.direccion || "—" },
        { key: "alta", label: "En el sistema desde", children: formatearFecha(empresa.fecha_creacion) }
      ]} />}
    </Card>
    {editor && <EditorMiEmpresa empresa={empresa} cerrar={() => setEditor(false)}
      guardada={(datos) => { actualizarUsuario({ nombre_empresa: datos.nombre }); consulta.recargar(); }} />}
  </>;
}
