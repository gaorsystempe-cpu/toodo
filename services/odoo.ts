
// Utility to escape XML special characters
const xmlEscape = (str: string) => 
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&apos;');

// Serializer for XML-RPC parameters
const serialize = (value: any): string => {
  if (value === null || value === undefined) {
    return `<string></string>`; // Odoo usually expects an empty string for nulls in XML-RPC
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? `<int>${value}</int>` : `<double>${value}</double>`;
  }
  if (typeof value === 'string') {
    return `<string>${xmlEscape(value)}</string>`;
  }
  if (typeof value === 'boolean') {
    return `<boolean>${value ? '1' : '0'}</boolean>`;
  }
  if (Array.isArray(value)) {
    return `<array><data>${value.map(v => `<value>${serialize(v)}</value>`).join('')}</data></array>`;
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
        return `<string>${value.toISOString()}</string>`;
    }
    return `<struct>${Object.entries(value).map(([k, v]) => 
      `<member><name>${k}</name><value>${serialize(v)}</value></member>`
    ).join('')}</struct>`;
  }
  return `<string>${xmlEscape(String(value))}</string>`;
};

// Parser for XML-RPC responses
const parseValue = (node: Element): any => {
  const child = node.firstElementChild;
  if (!child) return node.textContent; 

  switch (child.tagName) {
    case 'string': return child.textContent;
    case 'int': 
    case 'i4': return parseInt(child.textContent || '0', 10);
    case 'double': return parseFloat(child.textContent || '0');
    case 'boolean': return child.textContent === '1';
    case 'array': 
      const dataNode = child.querySelector('data');
      if (!dataNode) return [];
      return Array.from(dataNode.children).map(parseValue);
    case 'struct':
      const obj: any = {};
      Array.from(child.children).forEach(member => {
        const name = member.querySelector('name')?.textContent || '';
        const valNode = member.querySelector('value');
        if (name && valNode) {
          obj[name] = parseValue(valNode);
        }
      });
      return obj;
    default: return child.textContent;
  }
};

export class OdooClient {
  private url: string;
  private db: string;
  private useProxy: boolean;
  
  private proxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  constructor(url: string, db: string, useProxy: boolean = false) {
    this.url = url.replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]) {
    const xml = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params.map(p => `<param><value>${serialize(p)}</value></param>`).join('')}</params></methodCall>`.trim();

    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;
    let lastError: any = null;

    if (!this.useProxy) {
      return this.executeFetch(targetUrl, xml);
    }

    // Try multiple proxies if one fails
    for (const proxyFn of this.proxies) {
      try {
        const fetchUrl = proxyFn(targetUrl);
        return await this.executeFetch(fetchUrl, xml);
      } catch (error: any) {
        lastError = error;
        // If it's an Odoo Fault, don't retry, just throw
        if (error.message.includes('Fallo de Odoo')) throw error;
        continue; 
      }
    }
    throw lastError || new Error("No se pudo conectar con el servidor Odoo.");
  }

  private async executeFetch(url: string, xml: string) {
    // Use Blob to ensure correct encoding and Content-Type handling by the browser/proxy
    const blob = new Blob([xml], { type: 'text/xml' });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'text/xml',
        // Manual Content-Type is sometimes overridden by Blob, which is safer
        'Content-Type': 'text/xml'
      },
      body: blob
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Error HTTP: ${response.status} ${errorText.slice(0, 50)}`);
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error("Respuesta vacía del servidor.");
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    const fault = doc.querySelector('fault');
    if (fault) {
      const faultValue = fault.querySelector('value');
      const faultStruct = faultValue ? parseValue(faultValue) : { faultString: 'Error desconocido en Odoo' };
      throw new Error(`Fallo de Odoo: ${faultStruct.faultString}`);
    }

    const paramNode = doc.querySelector('params param value');
    if (!paramNode) throw new Error('Respuesta XML-RPC sin datos válidos.');
    
    return parseValue(paramNode);
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    const uid = await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
    if (uid === false || uid === undefined || typeof uid !== 'number') {
      throw new Error("Autenticación fallida. Verifique sus credenciales.");
    }
    return uid;
  }

  async searchRead(uid: number, apiKey: string, model: string, domain: any[], fields: string[], options: any = {}) {
    return await this.rpcCall('object', 'execute_kw', [
        this.db, uid, apiKey, model, 'search_read', [domain], { fields, ...options }
    ]);
  }

  async create(uid: number, apiKey: string, model: string, vals: any, context: any = {}) {
    return await this.rpcCall('object', 'execute_kw', [
        this.db, uid, apiKey, model, 'create', [vals], { context }
    ]);
  }
}
