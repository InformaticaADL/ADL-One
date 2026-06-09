import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_ENV_VARS = [
    'JWT_SECRET',
    'DB_SERVER',
    'DB_DATABASE',
    'DB_USER',
    'DB_PASSWORD',
];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`❌ FATAL: Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
    console.error('   Copia .env.example a .env y configura los valores requeridos.');
    process.exit(1);
}

// Fortaleza del JWT_SECRET: rechazar secretos débiles o por defecto.
// Un secreto débil permite a un atacante firmar tokens válidos de cualquier usuario.
const WEAK_JWT_SECRETS = new Set([
    'adl.2024#',
    'generate_a_random_secret_here',
    'secret', 'changeme', 'your_jwt_secret', 'jwt_secret',
]);
const jwtSecret = process.env.JWT_SECRET;
if (WEAK_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
    console.error('❌ FATAL: JWT_SECRET es débil o por defecto.');
    console.error('   Debe ser aleatorio y de al menos 32 caracteres.');
    console.error('   Genera uno con:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
}
