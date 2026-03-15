const fs = require('fs');
const { execSync } = require('child_process');

console.log('Reading .env.local...');
const envFile = fs.readFileSync('.env.local', 'utf-8');
const lines = envFile.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const splitIndex = line.indexOf('=');
    if (splitIndex === -1) continue;

    let key = line.substring(0, splitIndex).trim();
    let value = line.substring(splitIndex + 1).trim();

    // Remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
    }

    // Replace literal \n with actual newlines
    value = value.replace(/\\n/g, '\n');

    console.log(`Setting environment variable: ${key}`);
    const environments = ['production', 'preview', 'development'];

    for (const env of environments) {
        try {
            const command = `npx vercel env rm ${key} ${env} -y`;
            try { execSync(command, { stdio: 'ignore' }); } catch (e) { } // remove first if exists

            // Using Powershell to stream value to vercel env add is tricky across platforms.
            // On Windows we will write a temporary txt file
            fs.writeFileSync('temp.txt', value);

            // Need to run powershell correctly, childprocess defaults to cmd.exe in Windows usually
            // but NextJS sets up environment. Lets just write to file and pipe via cmd:
            const addCmd = `type temp.txt | npx vercel env add ${key} ${env}`;
            execSync(addCmd, { stdio: ['pipe', 'ignore', 'ignore'] });

        } catch (err) {
            console.error(`Failed to set ${key} for ${env}: ${err.message}`);
        }
    }
}
try { fs.unlinkSync('temp.txt'); } catch (e) { }
console.log('All variables set!');
