IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('rel_chat_participante') AND name = 'ocultar_si_vacio')
BEGIN
    ALTER TABLE rel_chat_participante ADD ocultar_si_vacio BIT NOT NULL DEFAULT 0;
END
GO
