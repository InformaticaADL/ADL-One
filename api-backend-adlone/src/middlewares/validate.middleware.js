import Joi from 'joi';
import logger from '../utils/logger.js';
import { errorResponse } from '../utils/response.js';

// Validation middleware factory
export const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(
            {
                body: req.body,
                query: req.query,
                params: req.params,
            },
            {
                abortEarly: false,
                stripUnknown: true,
            }
        );

        if (error) {
            const details = error.details.map(detail => {
                const field = detail.path.join('.');
                return `${field}: ${detail.message}`;
            });

            logger.warn(`Validation error on ${req.method} ${req.path}: ${details.join(', ')}`);
            return errorResponse(res, 'Error de validación', 400, details);
        }

        // Replace request data with validated data
        if (value.body) req.body = value.body;
        if (value.query) req.query = value.query;
        if (value.params) req.params = value.params;

        next();
    };
};

// Ficha validation schemas
export const fichaValidationSchemas = {
    create: Joi.object({
        body: Joi.object({
            antecedentes: Joi.object().required(),
            analisis: Joi.array().items(Joi.object()).required(),
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object(),
    }),

    approve: Joi.object({
        body: Joi.object({
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    reject: Joi.object({
        body: Joi.object({
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    updateAgenda: Joi.object({
        body: Joi.object({
            idMuestreador: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
            fecha: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
            observaciones: Joi.string().max(5000).optional(),
            fecha_programada: Joi.date().optional(),
            hora_inicio: Joi.string().regex(/^\d{2}:\d{2}$/).optional(),
            muestreadores: Joi.array().items(Joi.number().positive()).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    approveCoordinacion: Joi.object({
        body: Joi.object({
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    reviewCoordinacion: Joi.object({
        body: Joi.object({
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    getAssignmentDetail: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            idEstadoMuestreo: Joi.string().regex(/^\d+$/).optional(),
        }),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    batchUpdateAgenda: Joi.object({
        body: Joi.object({
            assignments: Joi.array().items(
                Joi.object({
                    id: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
                    idMuestreadorInstalacion: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
                    idMuestreadorRetiro: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
                    fecha: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
                }).unknown(true)
            ).required(),
            user: Joi.object().optional(),
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object(),
    }),

    getById: Joi.object({
        body: Joi.object(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    getEnProceso: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            month: Joi.number().integer().min(1).max(12).optional(),
            year: Joi.number().integer().min(2000).max(2100).optional(),
        }),
        params: Joi.object(),
    }),
};

// URS validation schemas
export const ursValidationSchemas = {
    createRequest: Joi.object({
        body: Joi.object({
            id_tipo: Joi.string().required(),
            // Controller acepta 'datos' o 'datos_json' (ambos nombres válidos)
            datos: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
            datos_json: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
            prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA').optional(),
            area_actual: Joi.string().optional(),
            observaciones: Joi.string().max(5000).optional(),
        }).or('datos', 'datos_json').unknown(true).required(),
        query: Joi.object(),
        params: Joi.object(),
    }),

    updateStatus: Joi.object({
        body: Joi.object({
            // Controller acepta tanto 'status' como 'estado' (legacy)
            status: Joi.string().valid('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REALIZADA').optional(),
            estado: Joi.string().valid('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REALIZADA').optional(),
            comment: Joi.string().max(5000).optional(),
            observaciones: Joi.string().max(5000).optional(),
        }).or('status', 'estado').unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    addComment: Joi.object({
        body: Joi.object({
            mensaje: Joi.string().max(5000).required(),
            es_privado: Joi.boolean().optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    createUpdateType: Joi.object({
        body: Joi.object({
            nombre: Joi.string().max(255).required(),
            descripcion: Joi.string().max(5000).optional(),
            estado: Joi.string().valid('ACTIVO', 'INACTIVO').optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().optional(),
        }),
    }),

    toggleTypeStatus: Joi.object({
        body: Joi.object({
            estado: Joi.string().valid('ACTIVO', 'INACTIVO').required(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    getRequests: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            estado: Joi.string().optional(),
            area_actual: Joi.string().optional(),
            mías: Joi.string().valid('true', 'false').optional(),
        }),
        params: Joi.object(),
    }),

    getRequestById: Joi.object({
        body: Joi.object(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    derive: Joi.object({
        body: Joi.object({
            // Controller acepta nombres alternativos para área destino
            area: Joi.string().optional(),
            area_destino: Joi.string().optional(),
            // Controller acepta nombres alternativos para usuario destino
            userId: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
            id_usuario_destino: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
            // Controller acepta nombres alternativos para rol
            roleId: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
            id_rol_destino: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
            // Motivo/comentario
            comment: Joi.string().max(5000).optional(),
            motivo: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),
};

// Analysis validation schemas
export const analysisValidationSchemas = {
    getReferenciasByNormativa: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            normativaId: Joi.string().required(),
        }).required(),
        params: Joi.object(),
    }),

    getAnalysisByNormativaReferencia: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            normativaId: Joi.string().required(),
            referenciaId: Joi.string().required(),
        }).required(),
        params: Joi.object(),
    }),
};

// Bulk Ficha validation schemas
export const bulkFichaValidationSchemas = {
    commitBatch: Joi.object({
        body: Joi.object({
            items: Joi.array().items(
                Joi.object({
                    antecedentes: Joi.object().required(),
                    analisis: Joi.array().items(Joi.object()).required(),
                }).unknown(true)
            ).required(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object(),
    }),
};

// Admin validation schemas
export const adminValidationSchemas = {
    getMuestreadores: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            nombre: Joi.string().allow('').max(255).optional(),
            estado: Joi.string().valid('ACTIVO', 'INACTIVO', 'ACTIVOS', 'INACTIVOS', 'TODOS').optional(),
        }),
        params: Joi.object(),
    }),

    createMuestreador: Joi.object({
        body: Joi.object({
            nombre: Joi.string().max(255).required(),
            correo: Joi.string().email().required(),
            clave: Joi.string().min(6).required(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object(),
    }),

    updateMuestreador: Joi.object({
        body: Joi.object({
            nombre: Joi.string().max(255).optional(),
            correo: Joi.string().email().optional(),
            clave: Joi.string().min(6).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    disableMuestreador: Joi.object({
        body: Joi.object(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    disableMuestreadorWithReassignment: Joi.object({
        body: Joi.object({
            reassignmentOptions: Joi.object().required(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    getCalendario: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            mes: Joi.number().integer().min(1).max(12).optional(),
            ano: Joi.number().integer().min(2000).max(2100).optional(),
        }),
        params: Joi.object(),
    }),

    getExportData: Joi.object({
        body: Joi.object(),
        query: Joi.object({
            name: Joi.string().required(),
            type: Joi.string().valid('TABLE', 'CHART', 'REPORT').optional(),
            params: Joi.string().optional(),
        }).required(),
        params: Joi.object(),
    }),
};
