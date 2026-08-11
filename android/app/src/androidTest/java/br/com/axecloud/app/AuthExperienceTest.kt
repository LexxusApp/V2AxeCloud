package br.com.axecloud.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AuthExperienceTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun loginShowsNativeAxeCloudIdentity() {
        compose.onNodeWithText("Entrar no AxéCloud").assertIsDisplayed()
        compose.onNodeWithText("Sou zelador(a)").assertIsDisplayed()
        compose.onNodeWithText("Sou filho(a)").assertIsDisplayed()
    }

    @Test
    fun childProfileChangesCredentialLanguage() {
        compose.onNodeWithText("Sou filho(a)").performClick()
        compose.onNodeWithText("Registro AxéCloud").assertIsDisplayed()
    }
}
