// Ayuda de interfaz. El backend vuelve a validar la secuencia en cada cambio.
export function puedeCambiarTarea(tarea, destino, tareas) {
  if (!tarea.id_tipo_tarea) return true;
  const mismaSecuencia = tareas.filter((t) => t.id_servicio_x_evento === tarea.id_servicio_x_evento);
  if (destino !== "pendiente" && tarea.orden > 1 && !mismaSecuencia.some((t) => t.orden === tarea.orden - 1 && t.estado_tarea === "completada")) return false;
  if (destino !== "completada" && tarea.estado_tarea === "completada" && mismaSecuencia.some((t) => t.orden === tarea.orden + 1 && ["en_curso", "completada"].includes(t.estado_tarea))) return false;
  return true;
}
