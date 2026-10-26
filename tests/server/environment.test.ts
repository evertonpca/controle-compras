import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvironment } from '../../src/server/environment.js';

const key = 'CONTROLE_COMPRAS_ENV_TEST';
let directory: string;
let originalValue: string | undefined;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'controle-compras-env-'));
  originalValue = process.env[key];
  delete process.env[key];
});

afterEach(() => {
  if (originalValue === undefined) delete process.env[key];
  else process.env[key] = originalValue;
  rmSync(directory, { recursive: true, force: true });
});

describe('environment loading', () => {
  it('aceita desenvolvimento sem arquivos de ambiente', () => {
    expect(() => loadEnvironment(directory)).not.toThrow();
  });

  it('carrega .env e prioriza .env.local', () => {
    writeFileSync(path.join(directory, '.env'), `${key}=fallback\n`);
    loadEnvironment(directory);
    expect(process.env[key]).toBe('fallback');
    delete process.env[key];
    writeFileSync(path.join(directory, '.env.local'), `${key}=local\n`);
    loadEnvironment(directory);
    expect(process.env[key]).toBe('local');
  });

  it('preserva variáveis configuradas pelo host', () => {
    writeFileSync(path.join(directory, '.env.local'), `${key}=local\n`);
    process.env[key] = 'host';
    loadEnvironment(directory);
    expect(process.env[key]).toBe('host');
  });
});
