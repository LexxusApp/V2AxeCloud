package br.com.axecloud.app.feature.finance

data class FinanceTransaction(val id: String, val description: String, val category: String, val date: String, val flow: String, val amount: Double, val status: String)
data class MonthlyCharge(val id: String, val name: String, val detail: String, val amount: Double, val status: String)
data class PixConfig(val key: String = "", val keyType: String = "CPF", val beneficiary: String = "", val monthlyValue: String = "", val dueDay: String = "10", val active: Boolean = true)
data class CashGoal(val id: String, val title: String, val current: Double, val target: Double)
data class CashDonation(val id: String, val goalId: String, val goalTitle: String, val donor: String, val amount: Double)
data class TransactionForm(val description: String = "", val flow: String = "entrada", val category: String = "Doação", val amount: String = "", val date: String = java.time.LocalDate.now().toString())
enum class FinanceSection { CASH, MONTHLY, PIX, GOALS }
data class FinanceUiState(
    val loading: Boolean = true, val saving: Boolean = false, val section: FinanceSection = FinanceSection.CASH,
    val transactions: List<FinanceTransaction> = emptyList(), val pending: List<MonthlyCharge> = emptyList(), val paid: List<MonthlyCharge> = emptyList(),
    val pix: PixConfig = PixConfig(), val goals: List<CashGoal> = emptyList(), val donations: List<CashDonation> = emptyList(),
    val creatingTransaction: Boolean = false, val editingPix: Boolean = false, val creatingGoal: Boolean = false,
    val actionId: String? = null, val error: String? = null, val message: String? = null,
) {
    val income get() = transactions.filter { !it.flow.contains("saida", true) && !it.flow.contains("saída", true) }.sumOf { it.amount }
    val expense get() = transactions.filter { it.flow.contains("saida", true) || it.flow.contains("saída", true) }.sumOf { it.amount }
    val balance get() = income - expense
}
