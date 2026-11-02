import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_DIR,
  HAS_REMOTE_STORE,
  HAS_VERCEL_KV,
  STORE_FILE,
  SUPABASE_KEY,
  SUPABASE_TABLE,
  SUPABASE_URL,
  VERCEL_KV_KEY,
  VERCEL_KV_TOKEN,
  VERCEL_KV_URL,
} from './config.js';

export type DocumentRecord = Record<string, unknown>;

/**
 * Persistência do documento de estado.
 *
 * - `file`: JSON local (desenvolvimento).
 * - `vercel-kv`: Vercel KV / Upstash Redis REST API nativo da Vercel (recomendado).
 * - `supabase`: uma linha JSONB via PostgREST (compatível com Vercel/serverless).
 */
export interface DocumentDriver {
  kind: 'file' | 'supabase' | 'vercel-kv';
  load(): Promise<DocumentRecord | null>;
  save(doc: DocumentRecord): Promise<void>;
  describe(): string;
}

function writeFileAtomic(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows pode bloquear o rename por antivírus/índice. Preserva os dados.
    fs.copyFileSync(tmp, file);
    fs.rmSync(tmp, { force: true });
  }
}

class FileDriver implements DocumentDriver {
  kind = 'file' as const;

  async load(): Promise<DocumentRecord | null> {
    if (!fs.existsSync(STORE_FILE)) return null;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw) as DocumentRecord;
  }

  async save(doc: DocumentRecord): Promise<void> {
    writeFileAtomic(STORE_FILE, JSON.stringify(doc, null, 2));
  }

  describe(): string {
    return 'Arquivo local (data/state.json)';
  }
}

class VercelKvDriver implements DocumentDriver {
  kind = 'vercel-kv' as const;
  private url = VERCEL_KV_URL;
  private token = VERCEL_KV_TOKEN;
  private key = VERCEL_KV_KEY;

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async load(): Promise<DocumentRecord | null> {
    const response = await fetch(`${this.url}/get/${encodeURIComponent(this.key)}`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Vercel KV retornou status ${response.status}: ${err.slice(0, 300)}`);
    }
    const data = (await response.json()) as { result?: unknown };
    if (data.result == null) return null;
    if (typeof data.result === 'string') {
      try {
        return JSON.parse(data.result) as DocumentRecord;
      } catch {
        return null;
      }
    }
    if (typeof data.result === 'object') {
      return data.result as DocumentRecord;
    }
    return null;
  }

  async save(doc: DocumentRecord): Promise<void> {
    const response = await fetch(`${this.url}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(['SET', this.key, JSON.stringify(doc)]),
    });
    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Vercel KV falhou ao persistir (${response.status}): ${err.slice(0, 300)}`);
    }
  }

  describe(): string {
    return 'Vercel KV (Armazenamento nativo do Vercel Storage)';
  }
}

class SupabaseDriver implements DocumentDriver {
  kind = 'supabase' as const;
  private endpoint = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(SUPABASE_TABLE)}`;

  private headers(): Record<string, string> {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  private async failure(response: Response): Promise<Error> {
    const body = await response.text().catch(() => '');
    const hint =
      response.status === 404 || body.includes('does not exist')
        ? ` A tabela "${SUPABASE_TABLE}" não existe: rode o SQL de supabase/schema.sql no SQL Editor.`
        : response.status === 401 || response.status === 403
        ? ' Confirme SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (a chave de serviço é obrigatória).'
        : '';
    return new Error(
      `Supabase respondeu ${response.status} em ${SUPABASE_TABLE}.${hint} ${body.slice(0, 300)}`.trim()
    );
  }

  async load(): Promise<DocumentRecord | null> {
    const response = await fetch(`${this.endpoint}?id=eq.1&select=doc`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!response.ok) throw await this.failure(response);
    const rows = (await response.json()) as Array<{ doc?: DocumentRecord }>;
    const doc = rows[0]?.doc;
    return doc && typeof doc === 'object' ? doc : null;
  }

  async save(doc: DocumentRecord): Promise<void> {
    const response = await fetch(`${this.endpoint}?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ id: 1, doc, updated_at: new Date().toISOString() }]),
    });
    if (!response.ok) throw await this.failure(response);
  }

  describe(): string {
    return 'Supabase Postgres (tabela hot_state)';
  }
}

class VercelFallbackDriver implements DocumentDriver {
  kind = 'file' as const;
  private file = path.join('/tmp', 'hot-state.json');
  private memDoc: DocumentRecord | null = null;

  async load(): Promise<DocumentRecord | null> {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf8');
        return JSON.parse(raw) as DocumentRecord;
      }
    } catch {
      // Ignora erro de leitura em fallback
    }
    return this.memDoc;
  }

  async save(doc: DocumentRecord): Promise<void> {
    this.memDoc = doc;
    try {
      writeFileAtomic(this.file, JSON.stringify(doc, null, 2));
    } catch {
      // Em serverless /tmp pode ter limites transitórios
    }
  }

  describe(): string {
    return 'Armazenamento temporário (/tmp). Vincule o Upstash Storage na Vercel para persistência permanente.';
  }
}

export function createDocumentDriver(): DocumentDriver {
  if (HAS_VERCEL_KV) return new VercelKvDriver();
  if (Boolean(SUPABASE_URL && SUPABASE_KEY)) return new SupabaseDriver();
  if (process.env.VERCEL) {
    console.warn(
      '[store] ATENÇÃO: Nenhum banco remoto (Vercel KV / Upstash) detectado. Usando armazenamento temporário em /tmp.'
    );
    return new VercelFallbackDriver();
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return new FileDriver();
}

export { writeFileAtomic };
