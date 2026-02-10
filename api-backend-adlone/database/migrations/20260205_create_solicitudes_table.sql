/* 
  Script para crear la tabla de solicitudes de equipos
  Maneja Alta, Traspaso y Baja de equipos.
*/

CREATE TABLE [dbo].[mae_solicitud_equipo](
	[id_solicitud] [numeric](10, 0) IDENTITY(1,1) NOT NULL,
	[tipo_solicitud] [varchar](20) NOT NULL, -- 'ALTA', 'TRASPASO', 'BAJA'
	[estado] [varchar](20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'APROBADO', 'RECHAZADO'
	[datos_json] [nvarchar](max) NOT NULL, -- Datos específicos del formulario en JSON
	[usuario_solicita] [numeric](10, 0) NULL,
	[usuario_revisa] [numeric](10, 0) NULL,
	[fecha_solicitud] [datetime] NOT NULL DEFAULT (getdate()),
	[fecha_revision] [datetime] NULL,
	[feedback_admin] [varchar](1000) NULL,
 CONSTRAINT [PK_mae_solicitud_equipo] PRIMARY KEY CLUSTERED 
(
	[id_solicitud] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

-- Índice para búsquedas rápidas por estado
CREATE INDEX IX_mae_solicitud_equipo_estado ON [dbo].[mae_solicitud_equipo] ([estado]);
GO
