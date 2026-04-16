import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    server: process.env.DB_SERVER,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const modulesData = [
    { id: 'gem', label: 'Ensayo Molecular', icon: 'IconDiamond', group: 'unidades', permission: 'GEM_ACCESO', order: 10, links: [{ label: 'Dashboard General', id: 'gem-dashboard', perm: '' }, { label: 'Reportes Consolidados', id: 'gem-reportes', perm: '' }, { label: 'Configuración', id: 'gem-config', perm: '' }] },
    { id: 'necropsia', label: 'Necropsia', icon: 'IconActivity', group: 'unidades', permission: 'NEC_ACCESO', order: 20 },
    { id: 'microscopia', label: 'Microscopía', icon: 'IconMicroscope', group: 'unidades', permission: 'MIC_ACCESO', order: 30 },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: 'IconDna', group: 'unidades', permission: 'BM_ACCESO', order: 40 },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: 'IconFlask', group: 'unidades', permission: 'CC_ACCESO', order: 50 },
    { id: 'bacteriologia', label: 'Bacteriología', icon: 'IconVirus', group: 'unidades', permission: 'BAC_ACCESO', order: 60 },
    { id: 'screening', label: 'Screening', icon: 'IconFilter', group: 'unidades', permission: 'SCR_ACCESO', order: 70 },
    { id: 'derivaciones', label: 'Derivaciones', icon: 'IconArrowsLeftRight', group: 'unidades', permission: 'DER_ACCESO', order: 80 },
    {
        id: 'medio_ambiente', label: 'Medio Ambiente', icon: 'IconLeaf', group: 'unidades', 
        permission: 'MA_ACCESO,FI_CONSULTAR,FI_NEW_CREAR,FI_EDITAR,MA_TECNICA_ACCESO,FI_ASIG_GRUPO,MA_CALENDARIO_ACCESO,MA_COMERCIAL_HISTORIAL_ACCESO,FI_APROBAR,FI_REVISION,FI_VER', order: 90,
        links: [
            { label: 'Fichas de ingreso', id: 'ma-fichas-ingreso', perm: 'MA_COMERCIAL_ACCESO,MA_TECNICA_ACCESO,MA_COORDINACION_ACCESO,FI_CONSULTAR,FI_NEW_CREAR,FI_ASIG_GRUPO,MA_CALENDARIO_ACCESO,FI_APROBAR,FI_REVISION,FI_VER' },
            { label: 'Reportes', id: 'ma-reportes-view', perm: 'MA_A_REPORTES' }
        ]
    },
    { id: 'atl', label: 'Área Técnica Local', icon: 'IconTruckDelivery', group: 'unidades', permission: 'ATL_ACCESO', order: 100 },
    { id: 'id', label: 'Investigación + D', icon: 'IconBulb', group: 'unidades', permission: 'ID_ACCESO', order: 110 },
    { id: 'pve', label: 'Vigilancia Epi.', icon: 'IconStethoscope', group: 'unidades', permission: 'PVE_ACCESO', order: 120 },
    { id: 'informatica', label: 'Informática', icon: 'IconCpu', group: 'unidades', permission: 'INF_ACCESO', order: 130 },
    { id: 'comercial', label: 'Comercial', icon: 'IconChartBar', group: 'unidades', permission: 'COM_ACCESO', order: 140 },
    {
        id: 'gestion_calidad', label: 'Gestión de Calidad', icon: 'IconCertificate', group: 'unidades', 
        permission: 'GC_ACCESO,MA_A_GEST_EQUIPO,GC_EQUIPOS,EQ_VER_SOLICITUD,MA_MUESTREADORES', order: 150,
        links: [
            { label: 'Fichas de ingreso', id: 'ma-fichas-ingreso', perm: 'GC_ACCESO' },
            { label: 'Gestión de Equipos', id: 'admin-equipos-gestion', perm: 'MA_A_GEST_EQUIPO,GC_EQUIPOS,EQ_VER_SOLICITUD' },
            { label: 'Gestión de Muestreadores', id: 'admin-muestreadores', perm: 'MA_MUESTREADORES' }
        ]
    },
    { id: 'administracion', label: 'Admin. Info', icon: 'IconBuilding', group: 'unidades', permission: 'ADM_ACCESO', order: 160 },
    { id: 'facturacion', label: 'Facturación', icon: 'IconCalculator', group: 'unidades', permission: 'FAC_ACCESO', order: 170 },
    { id: 'estadistica', label: 'Estadística', icon: 'IconChartPie', group: 'unidades', permission: 'EST_ACCESO', order: 180 },
    { id: 'admin_informacion', label: 'Admin. Info', icon: 'IconSettings', group: 'gestion', permission: 'AI_ACCESO', order: 190 }
];

async function seedMenu() {
    try {
        console.log('Connecting to', config.server);
        const pool = await sql.connect(config);
        
        console.log("Descartando tablas existentes (si aplica)...");
        await pool.request().query(`
            IF OBJECT_ID('mae_menu_link', 'U') IS NOT NULL DROP TABLE mae_menu_link;
            IF OBJECT_ID('mae_menu_modulo', 'U') IS NOT NULL DROP TABLE mae_menu_modulo;
        `);

        console.log("Creando tabla mae_menu_modulo...");
        await pool.request().query(`
            CREATE TABLE mae_menu_modulo (
                id_modulo NVARCHAR(50) PRIMARY KEY,
                label NVARCHAR(100) NOT NULL,
                icon_name NVARCHAR(50),
                grupo NVARCHAR(20) DEFAULT 'unidades',
                permissions_str NVARCHAR(500),
                sort_order INT DEFAULT 0,
                activo BIT DEFAULT 1
            );
        `);

        console.log("Creando tabla mae_menu_link...");
        await pool.request().query(`
            CREATE TABLE mae_menu_link (
                id_link INT PRIMARY KEY IDENTITY(1,1),
                id_modulo NVARCHAR(50) FOREIGN KEY REFERENCES mae_menu_modulo(id_modulo),
                id_accion NVARCHAR(100) NOT NULL,
                label NVARCHAR(100) NOT NULL,
                permissions_str NVARCHAR(500),
                sort_order INT DEFAULT 0,
                activo BIT DEFAULT 1
            );
        `);

        console.log("Insertando módulos y subenlaces...");
        for (const mod of modulesData) {
            await pool.request()
                .input('id', sql.NVarChar(50), mod.id)
                .input('lbl', sql.NVarChar(100), mod.label)
                .input('icn', sql.NVarChar(50), mod.icon)
                .input('grp', sql.NVarChar(20), mod.group)
                .input('perm', sql.NVarChar(500), mod.permission)
                .input('srt', sql.Int, mod.order)
                .query(`
                    INSERT INTO mae_menu_modulo (id_modulo, label, icon_name, grupo, permissions_str, sort_order)
                    VALUES (@id, @lbl, @icn, @grp, @perm, @srt)
                `);

            if (mod.links && mod.links.length > 0) {
                let linkOrder = 1;
                for (const link of mod.links) {
                    await pool.request()
                        .input('mid', sql.NVarChar(50), mod.id)
                        .input('aid', sql.NVarChar(100), link.id)
                        .input('lbl', sql.NVarChar(100), link.label)
                        .input('perm', sql.NVarChar(500), link.perm)
                        .input('srt', sql.Int, linkOrder * 10)
                        .query(`
                            INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order)
                            VALUES (@mid, @aid, @lbl, @perm, @srt)
                        `);
                    linkOrder++;
                }
            }
        }
        
        console.log("¡Sembrado completado existosamente!");
        process.exit(0);
    } catch (err) {
        console.error("Error al sembrar la base de datos:", err);
        process.exit(1);
    }
}

seedMenu();
