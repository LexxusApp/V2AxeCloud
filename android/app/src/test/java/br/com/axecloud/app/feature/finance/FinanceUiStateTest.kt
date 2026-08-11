package br.com.axecloud.app.feature.finance

import org.junit.Assert.assertEquals
import org.junit.Test

class FinanceUiStateTest {
    @Test fun saldoConsideraEntradasESaidasComAcentoOuSemAcento(){
        val state=FinanceUiState(transactions=listOf(
            FinanceTransaction("1","Mensalidade","Mensalidade","2026-08-01","entrada",300.0,"pago"),
            FinanceTransaction("2","Compra","Material","2026-08-02","saida",80.0,""),
            FinanceTransaction("3","Conta","Conta","2026-08-03","saída",20.0,""),
        ))
        assertEquals(300.0,state.income,0.001)
        assertEquals(100.0,state.expense,0.001)
        assertEquals(200.0,state.balance,0.001)
    }
}
