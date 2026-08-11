package br.com.axecloud.app.feature.precepts

import org.junit.Assert.assertEquals
import org.junit.Test

class PreceptUiStateTest {
    private val active=PreceptCycle("1","Resguardo","","Orientação","corrente",emptyList(),"2026-08-01","2026-08-08","ativo",PreceptCounts(total=3))
    private val draft=active.copy(id="2",title="Rascunho",status="rascunho")
    private val ended=active.copy(id="3",title="Encerrado",status="encerrado")

    @Test fun filtrosSeparamCiclosSemPerderHistorico(){
        val all=listOf(active,draft,ended)
        assertEquals(listOf("1"),PreceptUiState(cycles=all,filter="ativos").visible.map{it.id})
        assertEquals(listOf("2"),PreceptUiState(cycles=all,filter="rascunhos").visible.map{it.id})
        assertEquals(listOf("3"),PreceptUiState(cycles=all,filter="encerrados").visible.map{it.id})
        assertEquals(3,PreceptUiState(cycles=all,filter="todos").visible.size)
    }
}
