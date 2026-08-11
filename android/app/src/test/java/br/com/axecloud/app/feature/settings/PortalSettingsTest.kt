package br.com.axecloud.app.feature.settings

import org.junit.Assert.assertEquals
import org.junit.Test

class PortalSettingsTest {
    @Test fun `normalizes a public address safely`() {
        assertEquals("ile-axe-oxum", normalizePublicSlug("Ilê Axé Oxum"))
    }

    @Test fun `resolves server and fallback public links`() {
        assertEquals("https://axecloud.com.br/terreiros/ile-axe", resolvePublicPortalUrl("", "ile-axe"))
        assertEquals("https://axecloud.com.br/terreiro/ile-axe", resolvePublicPortalUrl("/terreiro/ile-axe", "ile-axe"))
        assertEquals("https://externo.test/casa", resolvePublicPortalUrl("https://externo.test/casa", "ile-axe"))
    }
}
