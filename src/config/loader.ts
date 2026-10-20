import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';
import { configSchema, type AppConfig } from './schema.js';

type Plain = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

export function deepMerge(base: Plain, override: Plain): Plain {
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return out;
}

/** Replaces ${VAR} / ${VAR:-fallback} before YAML parsing, so values keep YAML-native typing. Comment lines are left alone. */
export function interpolate(raw: string, env: NodeJS.ProcessEnv): string {
  return raw
    .split('\n')
    .map((line) =>
      line.trimStart().startsWith('#')
        ? line
        : line.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_m, name: string, fallback?: string) => {
            const value = env[name];
            if (value !== undefined && value !== '') return value;
            if (fallback !== undefined) return fallback;
            throw new Error(`Missing required environment variable ${name}`);
          }),
    )
    .join('\n');
}

function readYaml(file: string, env: NodeJS.ProcessEnv): Plain {
  if (!existsSync(file)) return {};
  const parsed = load(interpolate(readFileSync(file, 'utf8'), env));
  return isPlainObject(parsed) ? parsed : {};
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, dir = path.resolve('config')): AppConfig {
  const envName = env.NODE_ENV ?? 'development';
  const merged = deepMerge(
    readYaml(path.join(dir, 'default.yaml'), env),
    readYaml(path.join(dir, `${envName}.yaml`), env),
  );
  const result = configSchema.safeParse(merged);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration for NODE_ENV=${envName}:\n${issues}`);
  }
  return result.data;
}
