import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle } from 'docx';
import fs from 'fs';

const doc = new Document({
    sections: [
        {
            properties: {},
            children: [
                new Paragraph({
                    text: 'Dossier Técnico Integral: Ecosistema ADL One',
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: 'Este documento proporciona una visión exhaustiva de la arquitectura, lógica de negocio y estructura de datos de la plataforma ADL One.',
                    spacing: { before: 200, after: 400 },
                }),

                new Paragraph({ text: '1. Arquitectura General y Stack Tecnológico', heading: HeadingLevel.HEADING_1 }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'La plataforma ADL One está diseñada como un ecosistema distribuido que integra gestión comercial, técnica y operativa en terreno.', break: 1 }),
                        new TextRun({ text: '• Servidor (Backend): Node.js con Express.', break: 1 }),
                        new TextRun({ text: '• Base de Datos: Microsoft SQL Server (MSSQL).', break: 1 }),
                        new TextRun({ text: '• Frontend Web: React con TypeScript.', break: 1 }),
                        new TextRun({ text: '• App Móvil: React Native (Integración con samplers).', break: 1 }),
                        new TextRun({ text: '• Comunicación en Tiempo Real: Socket.io para notificaciones instantáneas.', break: 1 }),
                        new TextRun({ text: '• Gestión de Archivos: Almacenamiento local de adjuntos y firmas digitales.', break: 1 }),
                        new TextRun({ text: '• Envío de Correos: Integración con SMTP vía Nodemailer.', break: 1 }),
                    ],
                }),

                new Paragraph({ text: '2. Seguridad y Control de Acceso (RBAC)', heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: 'El sistema implementa un modelo de Control de Acceso Basado en Roles (RBAC) altamente granular.' }),
                new Paragraph({ text: 'Lógica de Autenticación', heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: 'El usuario se autentica mediante su nombre_usuario y clave_usuario. La sesión se gestiona mediante JSON Web Tokens (JWT) y se verifica el estado habilitado = \'S\' en la tabla mae_usuario.' }),
                
                new Paragraph({ text: 'Roles y Permisos', heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: '• Usuarios: Entidades individuales vinculadas a cargos.' }),
                new Paragraph({ text: '• Roles: Agrupaciones de permisos (ej: SuperAdmin, Coordinador Técnica, Muestreador).' }),
                new Paragraph({ text: '• Permisos: Acciones específicas dentro de módulos (ej: RBAC_MANAGE, MA_FICHA_TECNICA, URS_RESOLVER).' }),

                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: 'Tabla', bold: true })] }),
                                new TableCell({ children: [new Paragraph({ text: 'Descripción', bold: true })] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: 'mae_usuario' })] }),
                                new TableCell({ children: [new Paragraph({ text: 'Maestro de usuarios (credenciales, contacto, estado).' })] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: 'mae_rol' })] }),
                                new TableCell({ children: [new Paragraph({ text: 'Catálogo de roles disponibles.' })] }),
                            ],
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: 'mae_permiso' })] }),
                                new TableCell({ children: [new Paragraph({ text: 'Catálogo de todos los permisos atómicos del sistema.' })] }),
                            ],
                        }),
                    ],
                }),

                new Paragraph({ text: '3. Sistema de Fichas de Ingreso (MAM - Medio Ambiente)', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
                new Paragraph({ text: 'Flujo de Vida de una Ficha', heading: HeadingLevel.HEADING_2 }),
                new Paragraph({
                    children: [
                        new TextRun({ text: '1. Ingreso Comercial: Creación con antecedentes generales.', break: 1 }),
                        new TextRun({ text: '2. Revisión Técnica: Validación de parámetros y normativas.', break: 1 }),
                        new TextRun({ text: '3. Aprobación/Validación: Asignación de Inspector Ambiental.', break: 1 }),
                        new TextRun({ text: '4. Agendamiento: Generación automática de servicios.', break: 1 }),
                        new TextRun({ text: '5. Asignación: Asignación de Muestreador ejecutor.', break: 1 }),
                        new TextRun({ text: '6. Ejecución en Terreno: Registro vía App Móvil (datos, fotos, firmas).', break: 1 }),
                        new TextRun({ text: '7. Finalización y Cierre: Sincronización de datos.', break: 1 }),
                    ],
                }),

                new Paragraph({ text: 'Funcionalidades Específicas', heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: '• Edición Técnica: Modificación de normativas y parámetros.' }),
                new Paragraph({ text: '• Reagendar: Cambio de fechas de muestreo programadas.' }),
                new Paragraph({ text: '• Cancelación: Anulación de servicios con registro de motivo.' }),
                new Paragraph({ text: '• Remuestreo: Creación de fichas vinculadas para repetición.' }),

                new Paragraph({ text: '4. Sistema Unificado de Solicitudes (URS)', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
                new Paragraph({ text: 'Tipos de Solicitud', heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: '• Traspaso de Equipos: Cambio de custodia entre muestreadores.' }),
                new Paragraph({ text: '• Baja de Equipo: Reporte de daño o pérdida.' }),
                new Paragraph({ text: '• Cancelación de Muestreo: Suspensión de ficha agendada.' }),
                new Paragraph({ text: '• Reporte de Problema / Ayuda: Consultas técnicas.' }),

                new Paragraph({ text: 'Ciclo de Solicitud', heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: 'Creación -> Derivación (Área/Usuario) -> Interacción (Chat/Adjuntos) -> Resolución (Cerrada/Rechazada).' }),

                new Paragraph({ text: '5. Sistema de Notificaciones (UNS)', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
                new Paragraph({ text: 'Canales: Web (Dashboard/Socket.io) y Email (Nodemailer). Lógica basada en disparadores (triggers) que consumen plantillas dinámicas.' }),

                new Paragraph({ text: '6. Administración e Información Base', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
                new Paragraph({ text: 'Gestión de Equipos (mae_equipo), Muestreadores (mae_muestreador), Catálogo de Parámetros y Maestros de Clientes/Centros.' }),

                new Paragraph({ text: 'Fin del Documento', alignment: AlignmentType.CENTER, spacing: { before: 600 } }),
            ],
        },
    ],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync('Documentacion_Tecnica_ADL_One.docx', buffer);
    console.log('Documento creado exitosamente: Documentacion_Tecnica_ADL_One.docx');
});
