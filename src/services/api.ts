
import { Seal, User, SealStatus, AppSettings, MovementHistory } from '../../types';
import { supabase } from './supabaseClient';

/**
 * SERVICIO MAESTRO DE DATOS (SUPABASE)
 * Centraliza la comunicación con la base de datos en la nube.
 */
export const ApiService = {
  // --- SELLOS / PRECINTOS ---
  async getSeals(): Promise<Seal[]> {
    try {
      const { data: seals, error } = await supabase
        .from('seals')
        .select('*, history(*)');
      
      if (error) throw error;
      
      return (seals || []).map((s: any) => ({
        ...s,
        history: (s.history || []).sort((a: any, b: any) => b.id - a.id)
      }));
    } catch (error) {
      console.error('Supabase Error (getSeals):', error);
      return [];
    }
  },

  async createSeal(seal: Seal): Promise<boolean> {
    try {
      const { history, ...sealData } = seal;
      
      const { error: sealError } = await supabase
        .from('seals')
        .insert([sealData]);
      
      if (sealError) throw sealError;

      if (history && history.length > 0) {
        const historyData = history.map((h: MovementHistory) => ({ ...h, sealId: seal.id }));
        const { error: historyError } = await supabase
          .from('history')
          .insert(historyData);
        if (historyError) throw historyError;
      }

      return true;
    } catch (error) {
      console.error('Supabase Error (createSeal):', error);
      return false;
    }
  },

  async deleteSeal(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('seals')
        .delete()
        .eq('id', id);
      
      return !error;
    } catch (error) {
      console.error('Supabase Error (deleteSeal):', error);
      return false;
    }
  },

  async updateSealStatus(ids: string[], status: SealStatus, details: string, user: string): Promise<boolean> {
    try {
      const now = new Date().toLocaleString('es-ES');
      
      for (const id of ids) {
        const { data: currentSeal } = await supabase
          .from('seals')
          .select('status')
          .eq('id', id)
          .single();

        if (currentSeal) {
          await supabase
            .from('seals')
            .update({ status, lastMovement: now })
            .eq('id', id);

          await supabase
            .from('history')
            .insert([{
              sealId: id,
              date: now,
              fromStatus: currentSeal.status,
              toStatus: status,
              user: user,
              details: ids.length > 1 ? `[MASIVO] ${details}` : details
            }]);
        }
      }
      return true;
    } catch (error) {
      console.error('Supabase Error (updateStatus):', error);
      return false;
    }
  },

  // --- USUARIOS ---
  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  async saveUser(user: User): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .upsert([user]);
      return !error;
    } catch {
      return false;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // --- CIUDADES ---
  async getCities(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('name');
      if (error) throw error;
      return (data || []).map((c: any) => c.name);
    } catch {
      return [];
    }
  },

  async addCity(name: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cities')
        .insert([{ name }]);
      return !error;
    } catch {
      return false;
    }
  },

  async deleteCity(name: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cities')
        .delete()
        .eq('name', name);
      return !error;
    } catch {
      return false;
    }
  },

  async updateCity(oldCity: string, newCity: string): Promise<boolean> {
    try {
      await supabase.from('cities').insert([{ name: newCity }]);
      await supabase.from('users').update({ city: newCity }).eq('city', oldCity);
      await supabase.from('seals').update({ city: newCity }).eq('city', oldCity);
      await supabase.from('cities').delete().eq('name', oldCity);
      return true;
    } catch {
      return false;
    }
  },

  // --- CONFIGURACIÓN ---
  async getSettings(): Promise<AppSettings | null> {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  async getBackup(): Promise<any> {
    try {
      const [seals, users, cities, settings] = await Promise.all([
        this.getSeals(),
        this.getUsers(),
        this.getCities(),
        this.getSettings()
      ]);
      return { seals, users, cities, settings };
    } catch {
      return null;
    }
  },

  async saveSettings(settings: AppSettings): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert([{ id: 1, ...settings }]);
      return !error;
    } catch {
      return false;
    }
  },

  async saveFullDb(data: any): Promise<boolean> {
    try {
      if (data.settings) {
        await this.saveSettings(data.settings);
      }
      // Note: For seals and users, it's recommended to use the specific 
      // createSeal/saveUser methods for better performance and consistency.
      return true;
    } catch (error) {
      console.error('Error in saveFullDb:', error);
      return false;
    }
  }
};
