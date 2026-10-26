import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

// Process variables (e.g. Render) take precedence, followed by .env.local and .env.
export function loadEnvironment(directory = process.cwd()): void {
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(directory, filename);
    if (existsSync(filePath)) loadEnvFile(filePath);
  }
}
