const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(projectRoot, 'package.json'));
const suppliedVersion = process.argv[2];

function isVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

async function getVersion() {
  if (suppliedVersion) {
    return suppliedVersion;
  }

  if (!process.stdin.isTTY) {
    return packageJson.version;
  }

  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await prompt.question(
      `VSIX version to install [${packageJson.version}]: `
    );
    return answer.trim() || packageJson.version;
  } finally {
    prompt.close();
  }
}

async function main() {
  const version = await getVersion();

  if (!isVersion(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  const vsixPath = path.join(projectRoot, `${packageJson.name}-${version}.vsix`);
  if (!fs.existsSync(vsixPath)) {
    throw new Error(`VSIX not found: ${vsixPath}`);
  }

  const isWindows = process.platform === 'win32';
  const executable = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'code';
  const args = isWindows
    ? ['/d', '/s', '/c', 'code.cmd', '--install-extension', vsixPath, '--force']
    : ['--install-extension', vsixPath, '--force'];
  const result = spawnSync(
    executable,
    args,
    { cwd: projectRoot, stdio: 'inherit' }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
