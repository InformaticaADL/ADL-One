import dotenv from 'dotenv';
dotenv.config();

console.log('--- ENV TEST ---');
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('LENGTH:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
console.log('----------------');
