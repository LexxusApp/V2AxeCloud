import os

file1 = 'cloudflare/prospect-worker/src/index.ts'
content1 = open(file1, 'r', encoding='utf-8').read()

target1 = "const isProspectingPaused = spToday > '2026-10-17';"
replacement1 = "// Prospecção autônoma ativa em horário comercial\n    const isProspectingPaused = false;"

if target1 in content1:
    content1 = content1.replace(target1, replacement1)
    open(file1, 'w', encoding='utf-8').write(content1)
    print("Sucesso: atualizado index.ts!")
else:
    print("Aviso: target1 não encontrado em index.ts")

file2 = 'cloudflare/prospect-worker/src/services/outreach/AutonomousProspectingService.ts'
content2 = open(file2, 'r', encoding='utf-8').read()

target2 = """    if (!force && spDate > '2026-10-17') {
      console.log(`[AutonomousProspecting] Prospecção fria pausada em ${spDate} para priorizar conversão dos interessados.`);
      return {
        dispatched: false,
        reason: 'prospecting_paused_admin_conversion_focus',
        sentCount: 0,
        skippedCount: 0,
        leadsProcessed: [],
      };
    }"""

if target2 in content2:
    content2 = content2.replace(target2, "// Pausa removida: prospecção autônoma reativada")
    open(file2, 'w', encoding='utf-8').write(content2)
    print("Sucesso: atualizado AutonomousProspectingService.ts!")
else:
    # Test CRLF
    target2_crlf = target2.replace("\n", "\r\n")
    if target2_crlf in content2:
        content2 = content2.replace(target2_crlf, "// Pausa removida: prospecção autônoma reativada")
        open(file2, 'w', encoding='utf-8').write(content2)
        print("Sucesso (CRLF): atualizado AutonomousProspectingService.ts!")
    else:
        print("Aviso: target2 não encontrado em AutonomousProspectingService.ts")
