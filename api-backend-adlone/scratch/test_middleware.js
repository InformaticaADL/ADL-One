// Simple mock test for verifyPermission logic
const verifyPermissionLogic = (requiredPermission, userPermissions) => {
    const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    return required.some(p => userPermissions.includes(p));
};

// Test cases
const tests = [
    { req: 'FI_CREAR', user: ['FI_CREAR', 'OTHER'], expected: true },
    { req: 'FI_CREAR', user: ['OTHER'], expected: false },
    { req: ['FI_CREAR', 'FI_EDITAR'], user: ['FI_EDITAR'], expected: true },
    { req: ['FI_CREAR', 'FI_EDITAR'], user: ['FI_ADMIN'], expected: false },
    { req: ['FI_CREAR', 'FI_EDITAR'], user: [], expected: false }
];

tests.forEach((t, i) => {
    const result = verifyPermissionLogic(t.req, t.user);
    console.log(`Test ${i+1}: ${result === t.expected ? 'PASSED' : 'FAILED'} (Req: ${t.req}, User: ${t.user})`);
});
