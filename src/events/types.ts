import type { SimulationParameters } from '../schemas/simulation.js';

export interface LineageEvents {
  'citizen:born': (citizenId: string, role: string, generation: number) => void;
  'citizen:died': (citizenId: string, deathProfile: string, generation: number) => void;
  'citizen:peak-transmission': (citizenId: string, transmissionId: string) => void;
  'generation:started': (generationNumber: number, citizenCount: number) => void;
  'generation:ended': (generationNumber: number) => void;
  'transmission:mutated': (transmissionId: string, mutationType: string) => void;
  'inheritance:composed': (generationNumber: number, layerCount: number) => void;
  'simulation:started': (seedProblem: string, config: SimulationParameters) => void;
  'simulation:ended': (generationCount: number) => void;
  'state:saved': (filePath: string) => void;
  'state:loaded': (filePath: string) => void;
}
