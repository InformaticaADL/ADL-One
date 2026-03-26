import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'ADL_ONE_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function check() {
    try {
        const pool = await sql.connect(config);
        
        const q1 = `
            IF NOT EXISTS (SELECT 1 FROM mae_evento_notificacion WHERE codigo_evento = 'SOLICITUD_DERIVACION')
            BEGIN
                INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, cuerpo_template_html)
                VALUES (
                    'SOLICITUD_DERIVACION', 
                    'Se dispara cuando una solicitud es derivada a un nuevo destinatario en URS.',
                    'Has recibido una solicitud a través de derivación: {{nombre_tipo}}',
                    '<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #1e3a8a;">Derivación de Solicitud</h2>
                        <p>Has recibido una nueva solicitud a través de derivación externa.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
                            <p style="margin: 0 0 5px;"><strong>ID Solicitud:</strong> #{{id_solicitud}}</p>
                            <p style="margin: 0 0 5px;"><strong>Tipo de Trámite:</strong> {{nombre_tipo}}</p>
                            <p style="margin: 0 0 5px;"><strong>Derivada por:</strong> {{usuario_accion}}</p>
                            <p style="margin: 0;"><strong>Motivo o Instrucciones:</strong> {{motivo}}</p>
                        </div>
                        <p>Por favor, revisa y acciona sobre esta solicitud ingresando a tu bandeja en el portal de reportes.</p>
                    </div>'
                );
            END
            ELSE
            BEGIN
                UPDATE mae_evento_notificacion
                SET 
                    asunto_template = 'Has recibido una solicitud a través de derivación: {{nombre_tipo}}',
                    cuerpo_template_html = '<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #1e3a8a;">Derivación de Solicitud</h2>
                        <p>Has recibido una nueva solicitud a través de derivación externa.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
                            <p style="margin: 0 0 5px;"><strong>ID Solicitud:</strong> #{{id_solicitud}}</p>
                            <p style="margin: 0 0 5px;"><strong>Tipo de Trámite:</strong> {{nombre_tipo}}</p>
                            <p style="margin: 0 0 5px;"><strong>Derivada por:</strong> {{usuario_accion}}</p>
                            <p style="margin: 0;"><strong>Motivo o Instrucciones:</strong> {{motivo}}</p>
                        </div>
                        <p>Por favor, revisa y acciona sobre esta solicitud ingresando a tu bandeja en el portal de reportes.</p>
                    </div>'
                WHERE codigo_evento = 'SOLICITUD_DERIVACION';
            END
        `;
        await pool.request().query(q1);
        console.log('Template SOLICITUD_DERIVACION verificado/insertado/actualizado exitosamente en mae_evento_notificacion.');

        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
check();
