UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'Pendiente Área Coordinación' WHERE id_validaciontecnica = 1;
UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'Rechazada Técnica' WHERE id_validaciontecnica = 2;
UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'Pendiente Técnica' WHERE id_validaciontecnica = 3 AND estado_ficha = 'VIGENTE';
UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'Rechazada Coordinación' WHERE id_validaciontecnica = 4;
UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'En Proceso' WHERE id_validaciontecnica = 5;
UPDATE App_Ma_FichaIngresoServicio_ENC SET estado_ficha = 'Pendiente Programación' WHERE id_validaciontecnica = 6;
