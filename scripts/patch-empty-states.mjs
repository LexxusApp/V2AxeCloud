import fs from 'fs';

const p = 'AxecloudV2/src/views/NoticeBoard.tsx';
let c = fs.readFileSync(p, 'utf-8');

const oldBlock = c.indexOf('{filteredNotices.length === 0 && (');
const endBlock = c.indexOf(')}', oldBlock) + 2;

const replacement = `{filteredNotices.length === 0 && (
              !notices.length ? (
                <div className="space-y-5">
                  <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-br from-white via-[#FCFAF5] to-[#F7EFE1] p-6 sm:p-8 shadow-[0_4px_24px_rgba(28,37,31,0.05)]">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#1F5942]/20 blur-2xl" />
                    
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E5AE12]/15 border border-[#E5AE12]/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8F630E] mb-3">
                        <span>✦</span>
                        <span>Comunicação Oficial & Alinhamento</span>
                      </div>
                      <h3 className="font-display text-2xl font-black text-[#17251D] sm:text-3xl">
                        Mural de Avisos & Transmissão WhatsApp
                      </h3>
                      <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-[#59655E] leading-relaxed">
                        Mantenha toda a corrente conectada e avisada. Publique avisos litúrgicos importantes com transmissão oficial para o WhatsApp de cada médium cadastrado.
                      </p>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        {isAdmin && (
                          <AxeButton
                            onClick={() => setComposerOpen(true)}
                            icon={Plus}
                            variant="primary"
                            size="lg"
                          >
                            Escrever primeiro comunicado
                          </AxeButton>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="rounded-2xl border border-[#A8DEC0] bg-gradient-to-br from-white to-[#F0FAF4] p-4 sm:p-5 shadow-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5EE] border border-[#B7E2CB] text-[#1F5942]">
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                        1. Avisos de Giras & Festas
                      </strong>
                      <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                        Data, horário, linha de trabalho, roupas e oferendas do dia.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#F8DC9B] bg-gradient-to-br from-white to-[#FFF9EB] p-4 sm:p-5 shadow-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF7E6] border border-[#FBE3B5] text-[#8F630E]">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                        2. Doutrina & Preceito
                      </strong>
                      <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                        Orientações de recolhimento, banhos de axé e fundamentos.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#BDD9EC] bg-gradient-to-br from-white to-[#F0F7FC] p-4 sm:p-5 shadow-xs">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FA] border border-[#CDE3F1] text-[#1E567B]">
                        <Send className="h-5 w-5" />
                      </div>
                      <strong className="mt-3 block font-display text-sm font-black text-[#17251D]">
                        3. Entrega no WhatsApp
                      </strong>
                      <p className="mt-1 text-xs font-medium text-[#59655E] leading-relaxed">
                        Disparo simultâneo garantido para todos os filhos de santo ativos.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <AxeEmptyState
                  icon={Megaphone}
                  title="Nenhum comunicado encontrado neste filtro"
                  description="Tente selecionar outra categoria ou limpar a busca acima."
                />
              )
            )}`;

if (oldBlock !== -1 && endBlock > oldBlock) {
  c = c.slice(0, oldBlock) + replacement + c.slice(endBlock);
  fs.writeFileSync(p, c, 'utf-8');
  console.log('NoticeBoard updated successfully');
} else {
  console.error('Block not found');
}
