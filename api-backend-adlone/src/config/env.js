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
