import fs from 'fs';

const filePath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/dashboard-berry/DashboardBerry.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update imports
const targetImport = `import React, { useMemo } from 'react';`;
const replacementImport = `import React, { useMemo, useRef, useState } from 'react';
import PreceitoCommandCenter, { type PreceitoCommandCenterHandle } from '../preceito/PreceitoCommandCenter';`;

code = code.replace(targetImport, replacementImport);

// 2. Add ref and state inside component
const targetComponentStart = `  tenantId,
}) => {`;

const replacementComponentStart = `  tenantId,
}) => {
  const preceitoRef = useRef<PreceitoCommandCenterHandle>(null);
  const [activePreceito, setActivePreceito] = useState<any>(null);`;

code = code.replace(targetComponentStart, replacementComponentStart);

// 3. Update Preceito Widget
const targetWidget = `          {/* Widget Preceito */}
          <article className="feature-widget-card widget-preceito">
            <div className="widget-content-left">
              <div className="widget-badge-row">
                <span className="widget-type">🔥 PRECEITO LITÚRGICO</span>
                <span className="widget-pill">Em repouso</span>
              </div>
              <h3 className="widget-title">A corrente está em repouso</h3>
              <p className="widget-desc">Nenhum ciclo de preceito ativo. A brasa permanece acesa, aguardando o próximo movimento litúrgico da casa.</p>
              <button className="widget-btn" type="button" onClick={() => onNavigate('calendar')}>
                <span>Iniciar ciclo de preceito</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="widget-visual">
              <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c99318" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </div>
          </article>`;

const replacementWidget = `          {/* Widget Preceito Integrado com Modal da Central de Preparação */}
          <article className="feature-widget-card widget-preceito">
            <div className="widget-content-left">
              <div className="widget-badge-row">
                <span className="widget-type">🔥 PRECEITO LITÚRGICO</span>
                <span className="widget-pill">{activePreceito ? 'Ativo' : 'Em repouso'}</span>
              </div>
              <h3 className="widget-title">
                {activePreceito ? activePreceito.titulo : 'A corrente está em repouso'}
              </h3>
              <p className="widget-desc">
                {activePreceito
                  ? 'Acompanhe a preparação e as confirmações de preceito da corrente.'
                  : 'Nenhum ciclo de preceito ativo. A brasa permanece acesa, aguardando o próximo movimento litúrgico da casa.'}
              </p>
              <button
                className="widget-btn cursor-pointer"
                type="button"
                onClick={() => {
                  if (activePreceito) {
                    preceitoRef.current?.openDetail(activePreceito);
                  } else {
                    preceitoRef.current?.openWizard();
                  }
                }}
              >
                <span>{activePreceito ? 'Acompanhar preceito' : 'Iniciar ciclo de preceito'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="widget-visual">
              <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c99318" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </div>
          </article>`;

code = code.replace(targetWidget, replacementWidget);

// 4. Render PreceitoCommandCenter at bottom
const targetEnd = `      </div>
    </div>
  );
};

export default DashboardBerry;`;

const replacementEnd = `        {/* Modais e sincronização do PreceitoCommandCenter */}
        <PreceitoCommandCenter
          ref={preceitoRef}
          tenantId={tenantId || ''}
          variant="hidden"
          onActiveCycleChange={(cycle) => setActivePreceito(cycle)}
        />
      </div>
    </div>
  );
};

export default DashboardBerry;`;

code = code.replace(targetEnd, replacementEnd);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully integrated PreceitoCommandCenter into DashboardBerry.tsx!');
