
import { supabase } from './supabaseClient';
import { ClientConfig } from '../types';

const ADMIN_PWD_KEY = 'LEMON_BI_ADMIN_PWD';
const DEFAULT_ADMIN_PWD = 'Luis2021.';

export const verifyAdminPassword = (password: string): boolean => {
    const storedPwd = localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_ADMIN_PWD;
    return storedPwd === password;
};

export const changeAdminPassword = (newPassword: string) => {
    localStorage.setItem(ADMIN_PWD_KEY, newPassword);
};

const mapRowToConfig = (row: any): ClientConfig => ({
    code: row.codigo_acceso,
    url: row.odoo_url,
    db: row.odoo_db,
    username: row.odoo_username,
    apiKey: row.odoo_api_key,
    companyFilter: row.filtro_compania,
    whatsappNumbers: row.whatsapp_numeros,
    isActive: row.estado ?? true,
    nombreComercial: row.nombre_comercial || row.codigo_acceso,
    logoUrl: row.logo_url || '',
    colorPrimario: row.color_primario || '#84cc16',
    colorSecundario: row.color_secundario || '#1e293b',
    colorAcento: row.color_acento || '#0ea5e9',
    showStore: row.tienda_habilitada ?? true,
    storeCategories: row.tienda_categorias || '',
    tiendaCategoriaNombre: row.tienda_categoria_nombre || 'Catalogo',
    hiddenProducts: Array.isArray(row.productos_ocultos) ? row.productos_ocultos.map(Number) : [],
    hiddenCategories: Array.isArray(row.categorias_ocultas) ? row.categorias_ocultas : [],
    yapeNumber: row.yape_numero || '',
    yapeName: row.yape_nombre || '',
    yapeQR: row.yape_qr || '',
    plinNumber: row.plin_numero || '',
    plinName: row.plin_nombre || '',
    plinQR: row.plin_qr || '',
    sedes_recojo: Array.isArray(row.sedes_recojo) ? row.sedes_recojo : [],
    campos_medicos_visibles: Array.isArray(row.campos_medicos_visibles) ? row.campos_medicos_visibles : ["registro", "laboratorio", "principio"],
    footer_description: row.footer_description || 'Ofrecemos los mejores productos con la garantía de expertos.',
    facebook_url: row.facebook_url || '',
    instagram_url: row.instagram_url || '',
    tiktok_url: row.tiktok_url || '',
    quality_text: row.quality_text || 'Autorizado por entidades competentes.',
    support_text: row.support_text || '¿Tienes dudas? Escríbenos.'
});

export const getClients = async (): Promise<ClientConfig[]> => {
    const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }

    return data.map(mapRowToConfig);
};

export const getClientByCode = async (code: string): Promise<ClientConfig | null> => {
    const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('codigo_acceso', code)
        .maybeSingle();
    
    if (error || !data) return null;
    return mapRowToConfig(data);
};

export const saveClient = async (client: ClientConfig, isNew: boolean): Promise<{ success: boolean; message?: string }> => {
    const fullPayload: any = {
        codigo_acceso: client.code,
        odoo_url: client.url,
        odoo_db: client.db,
        odoo_username: client.username,
        odoo_api_key: client.apiKey,
        filtro_compania: client.companyFilter,
        whatsapp_numeros: client.whatsappNumbers,
        estado: client.isActive,
        nombre_comercial: client.nombreComercial,
        logo_url: client.logoUrl,
        color_primario: client.colorPrimario,
        color_secundario: client.colorSecundario,
        color_acento: client.colorAcento,
        tienda_habilitada: client.showStore,
        // Fixed error: Property 'tienda_categoria_nombre' does not exist on type 'ClientConfig'. Did you mean 'tiendaCategoriaNombre'?
        tienda_categoria_nombre: client.tiendaCategoriaNombre || 'Catalogo',
        productos_ocultos: client.hiddenProducts || [],
        categorias_ocultas: client.hiddenCategories || [],
        yape_numero: client.yapeNumber,
        yape_nombre: client.yapeName,
        yape_qr: client.yapeQR,
        plin_numero: client.plinNumber,
        plin_nombre: client.plinName,
        plin_qr: client.plinQR,
        sedes_recojo: client.sedes_recojo || [],
        campos_medicos_visibles: client.campos_medicos_visibles || ["registro", "laboratorio", "principio"],
        footer_description: client.footer_description,
        facebook_url: client.facebook_url,
        instagram_url: client.instagram_url,
        tiktok_url: client.tiktok_url,
        quality_text: client.quality_text,
        support_text: client.support_text
    };

    try {
        if (isNew) {
            const { error } = await supabase.from('empresas').insert([fullPayload]);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('empresas').update(fullPayload).eq('codigo_acceso', client.code);
            if (error) throw error;
        }
        return { success: true };
    } catch (error: any) {
        console.error('Error saving client:', error);
        return { success: false, message: error.message || 'Error al guardar.' };
    }
};

export const deleteClient = async (code: string): Promise<boolean> => {
    const { error } = await supabase.from('empresas').delete().eq('codigo_acceso', code);
    if (error) return false;
    return true;
};
