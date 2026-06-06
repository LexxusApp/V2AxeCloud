#!/usr/bin/env node
/** Diagnóstico EFI/PIX no container (sem imprimir segredos). */
import { resolveEfiEnv, resolveEfiPayeeCode } from "../../api/lib/efiPay.ts";
import { getEfiPixSetupDiagnostics, resolveEfiPixEnv } from "../../api/lib/efiPixApi.ts";
import { efiNotificationUrl } from "../../api/lib/tenantOnboarding.ts";

const efi = resolveEfiEnv();
const pix = resolveEfiPixEnv();
const diag = getEfiPixSetupDiagnostics();
const notifyUrl = efiNotificationUrl();

const maskedNotify = notifyUrl.replace(/secret=[^&]+/, "secret=***");

console.log(
  JSON.stringify(
    {
      efiCobrancas: efi
        ? { sandbox: efi.sandbox, baseUrl: efi.baseUrl, clientIdLen: efi.clientId.length }
        : null,
      pix: pix ? { available: true, baseUrl: pix.baseUrl, pixKeyLen: pix.pixKey.length } : { available: false, diagnostics: diag },
      webhookUrl: maskedNotify,
      webhookSecretConfigured: !!String(process.env.EFI_WEBHOOK_SECRET || "").trim(),
      cardCheckoutEnabled: false,
      payeeCodeConfigured: !!resolveEfiPayeeCode(),
    },
    null,
    2
  )
);
