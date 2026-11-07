import { getEfiPixSetupDiagnostics } from '../api/lib/efiPixApi.js';
import dotenv from 'dotenv';
dotenv.config();

console.log(getEfiPixSetupDiagnostics());
