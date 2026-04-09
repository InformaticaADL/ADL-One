
import { execSync } from 'child_process';

const pid = 1412;
try {
    const output = execSync(`wmic process where processid=${pid} get ExecutablePath, CommandLine, Name`).toString();
    console.log(output);
} catch (e) {
    console.error(e.message);
}
