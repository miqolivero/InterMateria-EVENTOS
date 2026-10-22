export const catalogos = {
  clientes: { titulo: "Clientes", singular: "cliente", id: "id_cliente", campos: [
    ["nombre", "Nombre", 100, true], ["apellido", "Apellido", 100, true], ["dni_cuit", "DNI / CUIT", 20],
    ["telefono", "Teléfono", 30], ["email", "Email", 150], ["direccion", "Dirección", 200]
  ] },
  tipos: { titulo: "Tipos de evento", singular: "tipo de evento", id: "id_tipo_evento", campos: [
    ["nombre", "Nombre", 100, true], ["descripcion", "Descripción", 300]
  ] },
  servicios: { titulo: "Servicios", singular: "servicio", id: "id_servicio", campos: [
    ["nombre", "Nombre", 100, true], ["descripcion", "Descripción", 300]
  ] },
  proveedores: { titulo: "Proveedores", singular: "proveedor", id: "id_proveedor", campos: [
    ["razon_social", "Razón social", 150, true], ["cuit", "CUIT", 13], ["telefono", "Teléfono", 30],
    ["email", "Email", 150], ["direccion", "Dirección", 200], ["observaciones", "Observaciones", 5000]
  ] },
  empleados: { titulo: "Personal", singular: "empleado", id: "id_empleado", campos: [
    ["legajo", "Legajo", 20, true], ["nombre", "Nombre", 100, true], ["apellido", "Apellido", 100, true],
    ["rol", "Rol laboral", 80], ["telefono", "Teléfono", 30], ["email", "Email", 150], ["cargo", "Cargo", 100],
    ["fecha_inicio", "Fecha de ingreso", null, false, "fecha"]
  ] }
};
