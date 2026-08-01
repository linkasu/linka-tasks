import { tableNames } from './adapter'

export function migrationStatements(database: string): string[] {
  const base = database.replace(/\/$/, '')
  return tableNames.map(table => `
    CREATE TABLE IF NOT EXISTS \`${base}/${table}\` (
      id Utf8 NOT NULL,
      payload JsonDocument NOT NULL,
      updated_at Timestamp NOT NULL,
      PRIMARY KEY (id)
    );
  `)
}
