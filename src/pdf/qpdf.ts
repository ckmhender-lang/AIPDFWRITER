import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function run(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Command failed: ${cmd} ${args.join(' ')}`));
    });
  });
}

export async function encryptPdf(input: {
  pdfBytes: Uint8Array;
  userPassword: string;
  ownerPassword?: string;
}): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'pdfapp-'));
  const inPath = join(dir, 'in.pdf');
  const outPath = join(dir, 'out.pdf');

  await writeFile(inPath, input.pdfBytes);

  const owner = input.ownerPassword ?? input.userPassword;

  await run('qpdf', [
    '--encrypt',
    input.userPassword,
    owner,
    '256',
    '--',
    inPath,
    outPath,
  ]);

  return new Uint8Array(await readFile(outPath));
}

export async function decryptPdf(input: {
  pdfBytes: Uint8Array;
  password: string;
}): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), 'pdfapp-'));
  const inPath = join(dir, 'in.pdf');
  const outPath = join(dir, 'out.pdf');

  await writeFile(inPath, input.pdfBytes);

  await run('qpdf', ['--password=' + input.password, '--decrypt', '--', inPath, outPath]);

  return new Uint8Array(await readFile(outPath));
}
