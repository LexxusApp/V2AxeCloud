package br.com.axecloud.app.designsystem.component

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.axecloud.app.R
import br.com.axecloud.app.designsystem.theme.AxeCloudThemeTokens

@Composable
fun AxeCloudBrand(modifier: Modifier = Modifier, centered: Boolean = false) {
    val alignment = if (centered) Alignment.CenterHorizontally else Alignment.Start
    Column(modifier = modifier, horizontalAlignment = alignment) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = if (centered) Arrangement.Center else Arrangement.Start,
        ) {
            Image(
                painter = painterResource(R.drawable.ic_axecloud_mark),
                contentDescription = null,
                modifier = Modifier.size(58.dp),
            )
            Spacer(Modifier.width(12.dp))
            Text(
                text = buildAnnotatedString {
                    append("Axé")
                    pushStyle(SpanStyle(color = AxeCloudThemeTokens.GoldStrong))
                    append("Cloud")
                    pop()
                },
                color = AxeCloudThemeTokens.Forest,
                fontSize = 31.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-1).sp,
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            text = "GESTÃO PARA TERREIROS",
            color = AxeCloudThemeTokens.Muted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 2.2.sp,
            textAlign = if (centered) TextAlign.Center else TextAlign.Start,
        )
    }
}
