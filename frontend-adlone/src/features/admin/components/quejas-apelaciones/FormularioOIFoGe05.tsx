import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import logoAdl from '../../../../assets/images/logo_adl.png';
import type { CampoFormulario, NotifCasilla, ValoresFormulario } from './formularioValores';

// =============================================================================
// Vista en pantalla del formulario OI-FoGe-05 "Quejas y Apelaciones" v01, con la
// misma estructura que la plantilla oficial de Gestión de Calidad. Es solo una
// vista: el documento oficial es el .odt que se descarga (mismos textos).
// Es una hoja de papel: fondo blanco y tinta negra también en modo oscuro.
// =============================================================================

const BORDE = 'border border-neutral-800';
const marca = (on: boolean) => (on ? 'X' : '');

function Casilla({ campo, resaltar, className, children }: { campo?: CampoFormulario; resaltar?: CampoFormulario | null; className?: string; children?: React.ReactNode }) {
    const activa = Boolean(campo && campo === resaltar);
    return (
        <td data-campo={campo} className={cn(BORDE, 'px-1.5 py-1 align-top whitespace-pre-wrap break-words transition-colors duration-500', activa && 'bg-amber-100 ring-2 ring-inset ring-amber-400', className)}>
            {children}
        </td>
    );
}
const Rotulo = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <td className={cn(BORDE, 'bg-neutral-100 px-1.5 py-1 align-top font-semibold', className)}>{children}</td>
);
const Vacio = ({ texto = '' }: { texto?: string }) => <span className="text-neutral-400">{texto}</span>;

function BloqueNotificacion({ titulo, n }: { titulo: string; n: NotifCasilla }) {
    return (
        <div className="mt-2">
            <p className="font-semibold">{titulo}</p>
            <table className="w-full border-collapse">
                <tbody>
                    <tr>
                        <Rotulo className="w-[22%]">Notificado a</Rotulo><Casilla className="w-[38%]">{n.notificadoA}</Casilla>
                        <Rotulo className="w-[14%]">Fecha</Rotulo><Casilla>{n.fecha}</Casilla>
                    </tr>
                    <tr><Rotulo>Vía de Notificación</Rotulo><Casilla className="whitespace-pre-wrap" >{n.via}</Casilla><td colSpan={2} className={BORDE} /></tr>
                    <tr><Rotulo>OBS:</Rotulo><Casilla className="min-h-6">{n.obs}</Casilla><td colSpan={2} className={BORDE} /></tr>
                </tbody>
            </table>
        </div>
    );
}

export function FormularioOIFoGe05({ v, resaltar = null, borrador = false, className }: {
    v: ValoresFormulario; resaltar?: CampoFormulario | null; className?: string;
    /** Mientras se crea el registro: las casillas obligatorias vacías muestran en gris qué va en ellas. */
    borrador?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const txt = (valor: string, pista: string) => valor || (borrador ? <Vacio texto={pista} /> : '');
    // La casilla que se está editando se lleva a la vista (sin mover la página entera).
    useEffect(() => {
        if (!resaltar) return;
        const el = ref.current?.querySelector<HTMLElement>(`[data-campo="${resaltar}"]`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [resaltar, v]);

    const caja = (titulo: string, campo: CampoFormulario, texto: string, alto = 'min-h-16', pista = '') => (
        <table className="mt-2 w-full border-collapse">
            <tbody>
                <tr><td className={cn(BORDE, 'px-1.5 py-1 font-semibold')}>{titulo}</td></tr>
                <tr><Casilla campo={campo} resaltar={resaltar}><div className={alto}>{pista ? txt(texto, pista) : texto}</div></Casilla></tr>
            </tbody>
        </table>
    );

    return (
        <div ref={ref} className={cn('mx-auto w-full max-w-[794px] bg-white p-5 font-[Arial,sans-serif] text-[11px] leading-snug text-black shadow-md ring-1 ring-black/10', className)}
            aria-label="Vista del formulario OI-FoGe-05">
            {/* Encabezado del documento controlado */}
            <table className="w-full border-collapse">
                <tbody>
                    <tr>
                        <td rowSpan={3} className={cn(BORDE, 'w-[22%] p-1.5 text-center align-middle')}><img src={logoAdl} alt="ADL Diagnostic Chile" className="mx-auto max-h-12" /></td>
                        <td className={cn(BORDE, 'px-1.5 py-1 text-center font-bold')}>FORMULARIO GENERAL DE GESTIÓN</td>
                        <td className={cn(BORDE, 'px-1.5 py-1 text-center')}>Área<br /><b>Gestión de Calidad</b></td>
                        <td className={cn(BORDE, 'px-1.5 py-1 text-center')}>Unidad<br /><b>No Aplica</b></td>
                    </tr>
                    <tr>
                        <td className={cn(BORDE, 'px-1.5 py-1 text-center')}>Versión 01</td>
                        <td className={cn(BORDE, 'px-1.5 py-1 text-center')}>Fecha Vigencia<br />20/06/2016</td>
                        <td className={cn(BORDE, 'px-1.5 py-1 text-center')}>Fecha Revisión<br />12/01/2026</td>
                    </tr>
                    <tr><td colSpan={3} className={cn(BORDE, 'px-1.5 py-1 text-center')}><b>CÓDIGO: OI-FoGe-05 (Quejas y Apelaciones)</b></td></tr>
                </tbody>
            </table>

            <h2 className="mt-4 text-center text-sm font-bold tracking-wide">QUEJAS Y APELACIONES</h2>
            <table className="ml-auto mt-2 border-collapse">
                <tbody><tr><Rotulo>N°:</Rotulo><Casilla campo="numero" resaltar={resaltar} className="min-w-32 font-mono font-bold">{v.numero || <Vacio texto="(se asigna al guardar)" />}</Casilla></tr></tbody>
            </table>

            {/* Datos */}
            <table className="mt-2 w-full border-collapse">
                <tbody>
                    <tr><td colSpan={5} className={cn(BORDE, 'bg-neutral-100 px-1.5 py-1 font-bold')}>Datos</td></tr>
                    <tr>
                        <Rotulo className="w-[18%]">Tipo</Rotulo>
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Queja</td><Casilla campo="tipo" resaltar={resaltar} className="w-8 text-center font-bold">{marca(v.tipo === 'queja')}</Casilla>
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Apelación</td><Casilla campo="tipo" resaltar={resaltar} className="w-8 text-center font-bold">{marca(v.tipo === 'apelacion')}</Casilla>
                    </tr>
                    <tr>
                        <Rotulo />
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Interno</td><Casilla campo="origen" resaltar={resaltar} className="text-center font-bold">{marca(v.origen === 'interno')}</Casilla>
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Externo</td><Casilla campo="origen" resaltar={resaltar} className="text-center font-bold">{marca(v.origen === 'externo')}</Casilla>
                    </tr>
                </tbody>
            </table>
            <table className="w-full border-collapse">
                <tbody>
                    <tr><Rotulo className="w-[18%]">Empresa*</Rotulo><Casilla campo="empresa" resaltar={resaltar} className="w-[38%]">{txt(v.empresa, 'Empresa')}</Casilla><td colSpan={2} className={BORDE} /></tr>
                    <tr><Rotulo>Nombre*</Rotulo><Casilla campo="nombre" resaltar={resaltar}>{txt(v.nombre, 'Nombre de contacto')}</Casilla><Rotulo className="w-[18%]">Fecha recepción</Rotulo><Casilla campo="fechaRecepcion" resaltar={resaltar}>{v.fechaRecepcion}</Casilla></tr>
                    <tr><Rotulo>Mail de Contacto*</Rotulo><Casilla campo="mail" resaltar={resaltar}>{txt(v.mail, 'correo@empresa.cl')}</Casilla><Rotulo>Hora recepción</Rotulo><Casilla campo="horaRecepcion" resaltar={resaltar}>{v.horaRecepcion}</Casilla></tr>
                    <tr><Rotulo>Fono de Contacto*</Rotulo><Casilla campo="fono" resaltar={resaltar}>{txt(v.fono, '+56…')}</Casilla><Rotulo>Fecha tratamiento</Rotulo><Casilla campo="fechaTratamiento" resaltar={resaltar}>{v.fechaTratamiento}</Casilla></tr>
                </tbody>
            </table>
            <p className="mt-1 text-[10px]">(*): Ítems obligatorios</p>

            {caja('Motivo de la Queja o Apelación:', 'motivo', v.motivo, 'min-h-20', 'Lo que el cliente presenta, con sus palabras…')}
            {caja('Tratamiento:', 'tratamiento', v.tratamiento, 'min-h-16', 'Se completa en la evaluación y el tratamiento.')}
            {caja('Conclusiones:', 'conclusiones', v.conclusiones, 'min-h-16', 'Se completa al cerrar el caso.')}
            {caja('Participantes', 'participantes', v.participantes, 'min-h-10', 'Se completa en el tratamiento.')}

            <p className="mt-3 font-bold">Notificaciones:</p>
            <BloqueNotificacion titulo="Inicio de proceso" n={v.inicio} />
            <BloqueNotificacion titulo="Avance de proceso:" n={v.avance} />
            <BloqueNotificacion titulo="Finalización de proceso:" n={v.fin} />

            <div className="mt-10 flex justify-end">
                <div className="w-56 border-t border-neutral-800 pt-1 text-center">Jefe de Gestión de Calidad</div>
            </div>
            <table className="mt-6 w-full border-collapse text-[10px]">
                <tbody>
                    <tr>
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Elaborado por: Alejandra Poblete</td>
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Revisado por: Patricio Bustos</td>
                        <td className={cn(BORDE, 'px-1.5 py-1')}>Aprobado por: Patricio Bustos</td>
                    </tr>
                    <tr><td className={cn(BORDE, 'h-6 px-1.5 py-1')}>Firma:</td><td className={cn(BORDE, 'px-1.5 py-1')}>Firma:</td><td className={cn(BORDE, 'px-1.5 py-1')}>Firma:</td></tr>
                </tbody>
            </table>
            <p className="mt-1 text-[9px] text-neutral-600">La copia original administrada por Gestión de Calidad posee las firmas correspondientes.</p>
        </div>
    );
}
