package br.com.axecloud.app.feature.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test
    fun `accepts a normalized account email`() {
        assertTrue(isRecoveryEmailValid("  casa@axecloud.com.br  "))
    }

    @Test
    fun `rejects incomplete recovery addresses`() {
        assertFalse(isRecoveryEmailValid("casa"))
        assertFalse(isRecoveryEmailValid("@axecloud.com.br"))
        assertFalse(isRecoveryEmailValid("casa@localhost"))
    }

    @Test
    fun `accepts a complete native registration`() {
        assertTrue(registrationValidation(RegistrationForm(houseName = "Ilê Axé", leaderName = "Mãe Ana", email = "ana@ile.com.br", password = "Axe@2026")) == null)
    }

    @Test
    fun `rejects a weak native registration password`() {
        assertTrue(registrationValidation(RegistrationForm(houseName = "Ilê Axé", leaderName = "Ana", email = "ana@ile.com.br", password = "12345678"))?.contains("minúscula") == true)
    }
}
