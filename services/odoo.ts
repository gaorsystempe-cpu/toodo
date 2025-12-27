
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
  
  // Lista de proxies para rotación en caso de 403/bloqueo
  private proxies = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  constructor(url: string, db: string, useProxy: boolean = false) {
    this.url = url.replace(/\/+$/, ''); 
    this.db = db;
    this.useProxy = useProxy;
  }

  private async rpcCall(endpoint: string, method: string, params: any[]) {
    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map(p => `<param><value>${serialize(p)}</value></param>`).join('')}
  </params>
</methodCall>`;

    const targetUrl = `${this.url}/xmlrpc/2/${endpoint}`;
    let lastError: any = null;

    // Si no usamos proxy, intento directo
    if (!this.useProxy) {
      return this.executeFetch(targetUrl, xml);
    }

    // Intentar con la lista de proxies si el primero falla (estrategia de reintento para 403)
    for (const proxyFn of this.proxies) {
      try {
        const fetchUrl = proxyFn(targetUrl);
        return await this.executeFetch(fetchUrl, xml);
      } catch (error: any) {
        lastError = error;
        console.warn(`Proxy fallido, intentando siguiente...`, error.message);
        // Si es un error de Odoo Fault, no reintentamos con otro proxy, el error es lógico
        if (error.message.includes('Fallo de Odoo')) throw error;
        continue; 
      }
    }

    throw lastError || new Error("Todos los métodos de conexión fallaron.");
  }

  private async executeFetch(url: string, xml: string) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
      },
      body: xml
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(`Error HTTP 403: Acceso denegado por el servidor u Odoo WAF.`);
      }
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    const fault = doc.querySelector('fault');
    if (fault) {
      const faultStruct = parseValue(fault.querySelector('value')!);
      throw new Error(`Fallo de Odoo: ${faultStruct.faultString} (${faultStruct.faultCode})`);
    }

    const paramNode = doc.querySelector('params param value');
    if (!paramNode) throw new Error('Respuesta XML-RPC inválida o vacía.');
    
    return parseValue(paramNode);
  }

  async authenticate(username: string, apiKey: string): Promise<number> {
    const uid = await this.rpcCall('common', 'authenticate', [this.db, username, apiKey, {}]);
    if (!uid) throw new Error("Fallo en la autenticación: Credenciales incorrectas.");
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
