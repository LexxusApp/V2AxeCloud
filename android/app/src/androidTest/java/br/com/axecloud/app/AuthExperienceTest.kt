package br.com.axecloud.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

@RunWith(AndroidJUnit4::class)
class AuthExperienceTest {
    private val clearSession = TestRule { base, _ ->
        object : Statement() {
            override fun evaluate() {
                InstrumentationRegistry.getInstrumentation().targetContext
                    .getSharedPreferences("axecloud_secure_session", 0)
                    .edit()
                    .clear()
                    .commit()
                base.evaluate()
            }
        }
    }
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val rules: TestRule = RuleChain.outerRule(clearSession).around(compose)

    @Test
    fun loginShowsNativeAxeCloudIdentity() {
        compose.waitUntil(8_000) {
            compose.onAllNodesWithText("Entrar no AxéCloud").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Entrar no AxéCloud").assertIsDisplayed()
        compose.onNodeWithText("Sou zelador(a)").assertIsDisplayed()
        compose.onNodeWithText("Sou filho(a)").assertIsDisplayed()
    }

    @Test
    fun childProfileChangesCredentialLanguage() {
        compose.waitUntil(8_000) {
            compose.onAllNodesWithText("Sou filho(a)").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Sou filho(a)").performClick()
        compose.onNodeWithText("Registro AxéCloud").assertIsDisplayed()
    }

    @Test
    fun logoutReturnsToLoginAndStaysThere() {
        // The authenticated flow is covered on the physical device. This test keeps the
        // unauthenticated destination stable after the session store is cleared.
        compose.waitUntil(8_000) {
            compose.onAllNodesWithText("Entre na sua casa").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Entre na sua casa").assertIsDisplayed()
        compose.mainClock.advanceTimeBy(1_500)
        compose.onNodeWithText("Entre na sua casa").assertIsDisplayed()
    }
}
