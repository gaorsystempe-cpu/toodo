
// Utility to escape XML special characters
const xmlEscape = (str: string) => 
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&apos;');

// Serializer for XML-RPC parameters
const serialize = (value: any): string => {
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
    return `<array><data>${value.map(serialize).join('')}</data></array>`;
  }
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Date) {
        return `<string>${value.toISOString()}</string>`;
    }
    return `<struct>${Object.entries(value).map(([k, v]) => 
      `<member><name>${k}</name><value>${serialize(v)}</value></member>`
    ).join('')}</struct>`;
  }
  return '';
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
  
  // Lista de proxies optimizada para peticiones POST con body
  private proxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  constructor(url: string, db: string, useProxy: boolean = false) {
    this.url = url.replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]) {
    // IMPORTANTE: El XML debe empezar sin espacios ni saltos de línea para evitar el error de Odoo
    const xml = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params.map(p => `<param><value>${serialize(p)}</value></param>`).join('')}</params></methodCall>`;

    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;
    let lastError: any = null;

    if (!this.useProxy) {
      return this.executeFetch(targetUrl, xml);
    }

    for (const proxyFn of this.proxies) {
      try {
        const fetchUrl = proxyFn(targetUrl);
        console.log(`Intentando conexión vía: ${fetchUrl.split('?')[0]}`);
        return await this.executeFetch(fetchUrl, xml);
      } catch (error: any) {
        lastError = error;
        // Si es un error de Odoo (Fault), el proxy funcionó pero la lógica falló, no reintentamos
        if (error.message.includes('Fallo de Odoo')) throw error;
        console.warn(`Proxy falló: ${error.message}`);
        continue; 
      }
    }

    throw lastError || new Error("No se pudo establecer conexión con Odoo a través de ningún proxy.");
  }

  private async executeFetch(url: string, xml: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: xml
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(`Error HTTP 403: El servidor Odoo o el Proxy denegó el acceso.`);
      }
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error("El servidor devolvió una respuesta vacía.");
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    // Verificar si el XML es válido
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error("La respuesta del servidor no es un XML válido.");
    }

    const fault = doc.querySelector('fault');
    if (fault) {
      const faultStruct = parseValue(fault.querySelector('value')!);
      throw new Error(`Fallo de Odoo: ${faultStruct.faultString} (${faultStruct.faultCode})`);
    }

    const paramNode = doc.querySelector('params param value');
    if (!paramNode) throw new Error('Respuesta XML-RPC sin datos de retorno.');
    
    return parseValue(paramNode);
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    const uid = await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
    if (!uid) throw new Error("Credenciales de Odoo incorrectas.");
    return uid;
  }

  async searchRead(uid: number, apiKey: string, model: string, domain: any[], fields: string[], options: any = {}) {
    const kwargs = {
        fields: fields,
        ...options
    };

    return await this.rpcCall('object', 'execute_kw', [
        this.db, 
        uid, 
        apiKey, 
        model, 
        'search_read', 
        [domain], 
        kwargs
    ]);
  }

  async create(uid: number, apiKey: string, model: string, vals: any, context: any = {}) {
    return await this.rpcCall('object', 'execute_kw', [
        this.db,
        uid,
        apiKey,
        model,
        'create',
        [vals],
        { context }
    ]);
  }
}
