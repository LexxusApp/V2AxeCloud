import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_billing_banner(output_path="public/banner-assinatura-pix.png"):
    size = (1024, 1024)
    # 1. Base dark background (#080C14)
    img = Image.new("RGBA", size, (8, 12, 20, 255))
    
    # 2. Criar aura luminosa gradiente no centro superior
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    center_x, center_y = 512, 420
    
    # Camadas de luz suave (dourado/âmbar #D97706 e esmeralda sutil)
    for r in range(480, 0, -20):
        alpha = int(35 * (1 - r / 480))
        glow_draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            fill=(217, 119, 6, alpha)
        )
    for r in range(260, 0, -15):
        alpha = int(45 * (1 - r / 260))
        glow_draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            fill=(245, 158, 11, alpha)
        )
    
    glow = glow.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img, glow)
    
    # 3. Desenhar elementos de borda técnica sutil
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([24, 24, 1000, 1000], radius=32, outline=(30, 41, 59, 200), width=2)
    draw.rounded_rectangle([32, 32, 992, 992], radius=26, outline=(15, 23, 42, 180), width=1)
    
    # 4. Inserir logo AxéCloud
    logo_path = "public/axecloud_512.png"
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA")
        logo_size = 200
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        logo_x = (size[0] - logo_size) // 2
        logo_y = 120
        img.paste(logo, (logo_x, logo_y), logo)
    
    # 5. Fontes
    font_bold = "C:/Windows/Fonts/segoeuib.ttf"
    font_reg = "C:/Windows/Fonts/segoeui.ttf"
    if not os.path.exists(font_reg):
        font_reg = font_bold

    font_brand = ImageFont.truetype(font_bold, 44)
    font_title = ImageFont.truetype(font_bold, 76)
    font_subtitle = ImageFont.truetype(font_bold, 46)
    font_badge = ImageFont.truetype(font_bold, 28)
    font_sub_info = ImageFont.truetype(font_reg, 32)
    font_pix_tag = ImageFont.truetype(font_bold, 26)

    # 6. Marca "AxéCloud"
    brand_text = "AxéCloud"
    bbox_brand = draw.textbbox((0, 0), brand_text, font=font_brand)
    w_brand = bbox_brand[2] - bbox_brand[0]
    draw.text(((size[0] - w_brand) // 2, 340), brand_text, font=font_brand, fill=(241, 245, 249))

    # Divisor sutil
    draw.line([(432, 410), (592, 410)], fill=(245, 158, 11, 220), width=4)

    # 7. Título Principal "PLANO PREMIUM"
    title_text = "PLANO PREMIUM"
    bbox_title = draw.textbbox((0, 0), title_text, font=font_title)
    w_title = bbox_title[2] - bbox_title[0]
    draw.text(((size[0] - w_title) // 2, 450), title_text, font=font_title, fill=(255, 255, 255))

    # 8. Subtítulo em destaque dourado "ATUALIZE SUA ASSINATURA"
    sub_text = "ATUALIZE SUA ASSINATURA"
    bbox_sub = draw.textbbox((0, 0), sub_text, font=font_subtitle)
    w_sub = bbox_sub[2] - bbox_sub[0]
    draw.text(((size[0] - w_sub) // 2, 550), sub_text, font=font_subtitle, fill=(251, 191, 36))

    # 9. Frase de contexto
    desc_text = "Mantenha a gestão e os dados do seu terreiro sempre ativos"
    bbox_desc = draw.textbbox((0, 0), desc_text, font=font_sub_info)
    w_desc = bbox_desc[2] - bbox_desc[0]
    draw.text(((size[0] - w_desc) // 2, 640), desc_text, font=font_sub_info, fill=(148, 163, 184))

    # 10. Badge central / Pilares incluídos
    badge_bg = (15, 23, 42, 230)
    badge_w, badge_h = 760, 90
    bx = (size[0] - badge_w) // 2
    by = 725
    draw.rounded_rectangle([bx, by, bx + badge_w, by + badge_h], radius=20, fill=badge_bg, outline=(51, 65, 85, 200), width=2)
    
    badge_txt = "MEMBROS  •  MENSALIDADES  •  GIRAS  •  FINANCEIRO"
    bbox_btxt = draw.textbbox((0, 0), badge_txt, font=font_badge)
    w_btxt = bbox_btxt[2] - bbox_btxt[0]
    h_btxt = bbox_btxt[3] - bbox_btxt[1]
    draw.text((bx + (badge_w - w_btxt) // 2, by + (badge_h - h_btxt) // 2 - 4), badge_txt, font=font_badge, fill=(203, 213, 225))

    # 11. Rodapé Pix Seguro
    pix_box_w, pix_box_h = 540, 56
    px = (size[0] - pix_box_w) // 2
    py = 865
    draw.rounded_rectangle([px, py, px + pix_box_w, py + pix_box_h], radius=28, fill=(6, 78, 59, 160), outline=(16, 185, 129, 180), width=1)
    pix_txt = "PAGAMENTO 100% SEGURO VIA PIX"
    bbox_pix = draw.textbbox((0, 0), pix_txt, font=font_pix_tag)
    w_pix = bbox_pix[2] - bbox_pix[0]
    h_pix = bbox_pix[3] - bbox_pix[1]
    draw.text((px + (pix_box_w - w_pix) // 2, py + (pix_box_h - h_pix) // 2 - 2), pix_txt, font=font_pix_tag, fill=(52, 211, 153))

    # 12. Salvar
    img = img.convert("RGB")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG", quality=95)
    print(f"Banner criado com sucesso em: {output_path}")

if __name__ == "__main__":
    create_billing_banner()
