import Inventory from './Inventory';

interface CamarinhaProps {
  tenantData?: unknown;
  userRole?: string;
  isAdminGlobal?: boolean;
  setActiveTab: (tab: string) => void;
}

/** Estoque ritual focado na camarinha — categoria dedicada do almoxarifado. */
export default function Camarinha(props: CamarinhaProps) {
  return <Inventory {...props} presetCategory="Camarinha" moduleTitle="Camarinha" />;
}
