// Simulated verifyPermission logic to verify our route change will work as intended
const verifyPermissionLogic = (required, userPermissions) => {
    if (!required) return true;
    
    // If requirement is a string, convert to array for uniform handling
    const requiredArr = Array.isArray(required) ? required : [required];
    
    // Check if user has AT LEAST ONE of the required permissions
    return requiredArr.some(p => userPermissions.includes(p));
};

const testScenarios = [
    {
        name: "Admin User",
        required: ['MA_A_GEST_EQUIPO', 'MA_ACCESO', 'EQ_VER_SOLICITUD'],
        userPerms: ['MA_A_GEST_EQUIPO', 'OTHER_PERM'],
        expected: true
    },
    {
        name: "Normal User with Module Access",
        required: ['MA_A_GEST_EQUIPO', 'MA_ACCESO', 'EQ_VER_SOLICITUD'],
        userPerms: ['MA_ACCESO', 'URS_CREAR'],
        expected: true
    },
    {
        name: "User with specific Request View Permission",
        required: ['MA_A_GEST_EQUIPO', 'MA_ACCESO', 'EQ_VER_SOLICITUD'],
        userPerms: ['EQ_VER_SOLICITUD'],
        expected: true
    },
    {
        name: "Unauthorized User",
        required: ['MA_A_GEST_EQUIPO', 'MA_ACCESO', 'EQ_VER_SOLICITUD'],
        userPerms: ['RANDOM_PERM'],
        expected: false
    }
];

console.log('--- Testing Permission Logic for Equipment Lookup ---');
testScenarios.forEach(scenario => {
    const result = verifyPermissionLogic(scenario.required, scenario.userPerms);
    console.log(`Scenario [${scenario.name}]: ${result === scenario.expected ? '✅ PASSED' : '❌ FAILED'} (Got ${result})`);
});
