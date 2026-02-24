
import { Seal, User, SealStatus, AppSettings } from '../types';

// Configura aquí la URL de tu API
const API_BASE_URL = '/api';

/**
 * SERVICIO MAESTRO DE DATOS
 * Centraliza la comunicación con el backend.
 */
export const ApiService = {
  // --- SELLOS / PRECINTOS ---
  async getSeals(): Promise<Seal[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/seals`);
      if (!response.ok) throw new Error('Error al obtener sellos');
      return await response.json();
    } catch (error) {
      console.error('Connection Error:', error);
      return [];
    }
  },

  async createSeal(seal: Seal): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/seals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seal),
      });
      return response.ok;
    } catch (error) {
      console.error('Error al guardar:', error);
      return false;
    }
  },

  async deleteSeal(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/seals/${id}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async updateSealStatus(ids: string[], status: SealStatus, details: string, user: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/seals/movement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status, details, user, date: new Date().toLocaleString('es-ES') }),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  // --- USUARIOS ---
  async getUsers(): Promise<User[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      return await response.json();
    } catch {
      return [];
    }
  },

  async saveUser(user: User): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // --- CIUDADES ---
  async getCities(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/cities`);
      return await response.json();
    } catch {
      return [];
    }
  },

  async addCity(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async deleteCity(name: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/cities/${name}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // --- CONFIGURACIÓN ---
  async getSettings(): Promise<AppSettings | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async saveSettings(settings: AppSettings): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};
