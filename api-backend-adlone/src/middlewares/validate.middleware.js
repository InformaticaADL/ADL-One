import Joi from 'joi';
import logger from '../utils/logger.js';

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
                // Remove the leading 'body.', 'query.', or 'params.' from the path
                const field = detail.path.join('.');
                return `${field}: ${detail.message}`;
            });

            logger.warn(`Validation error: ${details.join(', ')}`);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: details,
            });
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
        body: Joi.array().items(
            Joi.object({
                id: Joi.string().required(),
                idMuestreador: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
                fecha: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
            }).unknown(true)
        ).required(),
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
            month: Joi.string().regex(/^\d{1,2}$/).optional(),
            year: Joi.string().regex(/^\d{4}$/).optional(),
        }),
        params: Joi.object(),
    }),
};

// URS validation schemas
export const ursValidationSchemas = {
    createRequest: Joi.object({
        body: Joi.object({
            id_tipo: Joi.string().required(),
            datos: Joi.alternatives().try(
                Joi.object(),
                Joi.string().required()
            ).required(),
            datos_json: Joi.alternatives().try(
                Joi.object(),
                Joi.string()
            ).optional(),
            prioridad: Joi.string().valid('BAJA', 'MEDIA', 'ALTA').optional(),
            area_actual: Joi.string().optional(),
            observaciones: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object(),
    }),

    updateStatus: Joi.object({
        body: Joi.object({
            status: Joi.string().valid('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'REALIZADA').required(),
            comment: Joi.string().max(5000).optional(),
        }).unknown(true).required(),
        query: Joi.object(),
        params: Joi.object({
            id: Joi.string().required(),
        }).required(),
    }),

    addComment: Joi.object({
        body: Joi.object({
            comentario: Joi.string().max(5000).required(),
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
            derivar_a: Joi.string().required(),
            observaciones: Joi.string().max(5000).optional(),
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
            nombre: Joi.string().max(255).optional(),
            estado: Joi.string().valid('ACTIVO', 'INACTIVO').optional(),
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
            mes: Joi.string().regex(/^\d{1,2}$/).optional(),
            ano: Joi.string().regex(/^\d{4}$/).optional(),
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
