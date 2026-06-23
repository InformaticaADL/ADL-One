/**
 * Protege endpoints destinados a llamadas servidor-a-servidor (api-app-mam ->
 * ADL ONE Web), distintas de los endpoints de usuario web (authenticate, que
 * exige un JWT de sesión de un usuario logueado). Se valida una clave
 * compartida fija en vez de un JWT porque el llamador es otro backend, no un
 * usuario autenticado. Mismo contrato y mismo valor de INTERNAL_API_KEY que
 * ya usa api-app-mam para el sentido inverso (regeneración de FoMa/Cadena).
 */
export const protectInternalService = (req, res, next) => {
    const key = req.headers['x-internal-key'];
    if (!process.env.INTERNAL_API_KEY) {
        console.error('INTERNAL_API_KEY no está configurada en .env');
        return res.status(500).json({ message: 'Servicio mal configurado.' });
    }
    if (!key || key !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ message: 'Clave interna inválida o ausente.' });
    }
    next();
};
