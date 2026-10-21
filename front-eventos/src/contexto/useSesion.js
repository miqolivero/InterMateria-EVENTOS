import { useContext } from "react";
import { SesionContexto } from "./SesionContexto";
export function useSesion() { return useContext(SesionContexto); }
