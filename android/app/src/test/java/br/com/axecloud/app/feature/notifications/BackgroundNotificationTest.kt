package br.com.axecloud.app.feature.notifications

import br.com.axecloud.app.feature.home.HomeFeedItem
import br.com.axecloud.app.feature.home.HomeSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BackgroundNotificationTest {
    @Test
    fun `prioritizes real pending work and preserves its destination`() {
        val snapshot = HomeSnapshot(
            houseName = "Ilê Axé",
            monthlyItems = listOf(HomeFeedItem(id = "m1", title = "João", detail = "vence hoje")),
            inventoryItems = listOf(HomeFeedItem(id = "i1", title = "Vela branca", status = "estoque baixo")),
        )

        val notifications = backgroundNotifications(snapshot)

        assertEquals("monthly:m1", notifications.first().id)
        assertEquals("finance", notifications.first().target)
        assertTrue(notifications.any { it.target == "management" && it.title.contains("Vela branca") })
    }

    @Test
    fun `does not repeat server notifications already read`() {
        val snapshot = HomeSnapshot(
            noticeItems = listOf(HomeFeedItem(id = "n1", title = "Aviso", status = "server:read")),
        )

        assertTrue(backgroundNotifications(snapshot).isEmpty())
    }
}
