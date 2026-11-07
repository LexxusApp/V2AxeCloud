import { createContext, useContext } from 'react';
export const ModernInterfaceContext = createContext(false);
export const useModernInterface = () => useContext(ModernInterfaceContext);
