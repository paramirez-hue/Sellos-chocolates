
import { Seal, User, SealStatus, AppSettings } from '../types';

// Configura aquí la URL de tu API
const API_BASE_URL = '/api';

/**
 * SERVICIO MAESTRO DE DATOS
 * Centraliza la comunicación con el backend.
 */
export const ApiService = {
  async getFullDb(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/db`);
      if (!response.ok) throw new Error('Error al obtener DB');
      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  },

  async saveFullDb(data: any): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (error) {
      console.error('Save error:', error);
      return false;
    }
  }
};
