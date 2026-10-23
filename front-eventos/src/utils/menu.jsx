import { BankOutlined, BookOutlined, CalendarOutlined, CheckSquareOutlined, DashboardOutlined,
  FileTextOutlined, ShopOutlined, TeamOutlined, UserOutlined, UserSwitchOutlined } from "@ant-design/icons";

// Roles y menú (Fase 10). UNA sola definición: cada opción dice qué roles la
// ven. De acá salen el menú de cada layout y las guardas de las rutas, así no
// hay listas de menú repetidas por rol que se puedan desincronizar.
//
// Es experiencia de usuario, no seguridad: la API vuelve a controlar cada
// pedido con su tabla de permisos.

export const SUPERADMIN = "superadmin";
export const ADMIN = "admin";
export const COORDINADOR = "coordinador";
export const EMPLEADO = "empleado";

const OPERACION = [ADMIN, COORDINADOR];
const EMPRESA = [ADMIN, COORDINADOR, EMPLEADO];

export const nombresRoles = {
  [SUPERADMIN]: "Superadmin",
  [ADMIN]: "Administrador",
  [COORDINADOR]: "Coordinador",
  [EMPLEADO]: "Empleado"
};

export const coloresRoles = { [ADMIN]: "purple", [COORDINADOR]: "blue", [EMPLEADO]: "cyan" };

// Pantalla de inicio de cada rol: a donde va al loguearse o si entra a una
// ruta que no es suya.
export const inicioDeRol = (rol) => ({
  [SUPERADMIN]: "/superadmin",
  [ADMIN]: "/seguimiento",
  [COORDINADOR]: "/seguimiento",
  [EMPLEADO]: "/mis-tareas"
})[rol] || "/login";

// ruta: el prefijo que activa la opción. exacta: solo esa ruta (el Resumen del
// superadmin no tiene que quedar marcado en /superadmin/empresas).
// tambien: otras rutas que pertenecen a la opción (un presupuesto se abre desde
// una solicitud). enMenu: false para rutas protegidas que no van en el menú.
export const opciones = [
  { ruta: "/superadmin", exacta: true, etiqueta: "Resumen", icono: <DashboardOutlined />, roles: [SUPERADMIN] },
  { ruta: "/superadmin/empresas", etiqueta: "Empresas", icono: <BankOutlined />, roles: [SUPERADMIN] },
  { ruta: "/seguimiento", etiqueta: "Seguimiento", icono: <DashboardOutlined />, roles: OPERACION },
  { ruta: "/mis-tareas", etiqueta: "Mis tareas", icono: <CheckSquareOutlined />, roles: EMPRESA },
  { ruta: "/solicitudes", tambien: ["/presupuestos"], etiqueta: "Solicitudes", icono: <FileTextOutlined />, roles: OPERACION },
  { ruta: "/eventos", etiqueta: "Eventos", icono: <CalendarOutlined />, roles: OPERACION },
  { ruta: "/clientes", etiqueta: "Clientes", icono: <UserOutlined />, roles: OPERACION },
  { ruta: "/catalogos", etiqueta: "Catálogos", icono: <BookOutlined />, roles: OPERACION },
  { ruta: "/personal", etiqueta: "Personal", icono: <TeamOutlined />, roles: [ADMIN] },
  { ruta: "/usuarios", etiqueta: "Usuarios", icono: <UserSwitchOutlined />, roles: [ADMIN] },
  { ruta: "/mi-empresa", etiqueta: "Mi empresa", icono: <ShopOutlined />, roles: EMPRESA }
];

const coincide = (prefijo, pathname, exacta = false) =>
  exacta ? pathname === prefijo : pathname === prefijo || pathname.startsWith(`${prefijo}/`);

// La opción a la que pertenece una ruta. Gana el prefijo más largo:
// /superadmin/empresas/3 es de "Empresas", no de "Resumen".
export function opcionDeRuta(pathname) {
  let mejor = null;
  let largo = -1;
  for (const opcion of opciones) {
    for (const prefijo of [opcion.ruta, ...(opcion.tambien || [])]) {
      const exacta = prefijo === opcion.ruta && opcion.exacta;
      if (coincide(prefijo, pathname, exacta) && prefijo.length > largo) {
        mejor = opcion;
        largo = prefijo.length;
      }
    }
  }
  return mejor;
}

// Una ruta que no es de ninguna opción (por ejemplo una que no existe) se deja
// pasar: la muestra la página 404.
export function puedeEntrar(rol, pathname) {
  const opcion = opcionDeRuta(pathname);
  return !opcion || opcion.roles.includes(rol);
}

// Las opciones del menú de un rol, en el formato de items del Menu de antd
export const menuDeRol = (rol) => opciones
  .filter((opcion) => opcion.roles.includes(rol))
  .map((opcion) => ({ key: opcion.ruta, icon: opcion.icono, label: opcion.etiqueta }));
