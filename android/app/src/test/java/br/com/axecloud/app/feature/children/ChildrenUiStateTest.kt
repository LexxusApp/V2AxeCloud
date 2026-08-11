package br.com.axecloud.app.feature.children

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChildrenUiStateTest {
    private val ana = ChildOfSaint(id="1",name="Ana",entryDate="2025-03-01",birthDate="1990-12-10",status="Ativo",userId="auth-1")
    private val bia = ChildOfSaint(id="2",name="Bia",entryDate="2026-01-10",birthDate="1995-02-20",status="Ativo",monthlyPending=true)
    private val caio = ChildOfSaint(id="3",name="Caio",entryDate="2024-05-10",birthDate="1988-08-01",status="Inativo")

    @Test fun semAcessoMostraSomenteQuemAindaNaoVinculouConta(){
        val state=ChildrenUiState(children=listOf(ana,bia,caio),filter=ChildStatusFilter.WITHOUT_ACCESS)
        assertEquals(listOf("Bia","Caio"),state.visibleChildren.map{it.name})
    }

    @Test fun ordenaEntradaDaMaisRecenteParaAntiga(){
        val state=ChildrenUiState(children=listOf(ana,bia,caio),sort=ChildSort.ENTRY)
        assertEquals(listOf("Bia","Ana","Caio"),state.visibleChildren.map{it.name})
    }

    @Test fun indicadoresFinanceirosSaoDerivadosDaCorrente(){
        val state=ChildrenUiState(children=listOf(ana,bia,caio))
        assertEquals(1,state.pendingMonthlyCount)
        assertEquals(2,state.withoutAccessCount)
        assertTrue(bia.monthlyPending)
    }
}
