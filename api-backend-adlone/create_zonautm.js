import { getConnection, closeConnection } from './src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    const pool = await getConnection();
    console.log('Connected to DB');

    // Create table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='mae_zonautm' and xtype='U')
      CREATE TABLE [dbo].[mae_zonautm](
        [id_zonautm] [numeric](10, 0) IDENTITY(1,1) NOT NULL,
        [nombre_zonautm] [varchar](50) NULL,
        [habilitado] [varchar](1) NULL DEFAULT 'S',
        CONSTRAINT [PK_mae_zonautm] PRIMARY KEY CLUSTERED ([id_zonautm] ASC)
      )
    `);
    console.log('Table mae_zonautm ensured.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeConnection();
  }
}

run();
