import { useEffect, useState } from 'react';
import { quejasApelacionesService as api } from '../../services/quejasApelaciones.service';

// Sugerencias de personas para responsable, aprobador, jefe de área, etc.: los usuarios de ADL-One
// («Nombre — Cargo»). El campo sigue siendo texto libre: se puede escribir a alguien que no esté.
// Se piden una sola vez por sesión y se comparten entre todos los campos.
let cache: string[] | null = null;
let pendiente: Promise<string[]> | null = null;

const cargar = () => {
    pendiente ??= api.usuarios()
        .then((us) => {
            cache = [...new Set(us.map((u) => (u.cargo ? `${u.nombre} — ${u.cargo}` : u.nombre)))];
            return cache;
        })
        .catch(() => { pendiente = null; return []; });
    return pendiente;
};

export function useSugerenciasPersonas(): string[] {
    const [lista, setLista] = useState<string[]>(() => cache || []);
    useEffect(() => {
        if (cache) return;
        let vigente = true;
        cargar().then((l) => { if (vigente) setLista(l); });
        return () => { vigente = false; };
    }, []);
    return lista;
}
