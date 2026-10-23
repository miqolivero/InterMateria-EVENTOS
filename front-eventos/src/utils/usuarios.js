import { ADMIN, COORDINADOR, EMPLEADO, nombresRoles } from "./menu.jsx";

// Opciones del Select de rol. Nunca superadmin: ese rol no se asigna desde una empresa.
export const opcionesRol = (roles = [ADMIN, COORDINADOR, EMPLEADO]) =>
  roles.map((rol) => ({ value: rol, label: nombresRoles[rol] }));

// Las mismas reglas que valida la API (al menos 6 caracteres)
export const reglasPassword = [
  { required: true, message: "Ingresá una contraseña." },
  { min: 6, message: "Tiene que tener al menos 6 caracteres." }
];

// Solo los campos de empresa que acepta la API, sin espacios de más y con null en los vacíos
export const datosEmpresa = (valores = {}) => Object.fromEntries(["nombre", "cuit", "email", "telefono", "direccion"]
  .map((campo) => [campo, typeof valores[campo] === "string" && valores[campo].trim() ? valores[campo].trim() : null]));
