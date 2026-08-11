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
}
