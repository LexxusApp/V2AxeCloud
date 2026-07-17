#!/usr/bin/env python3
"""Aplica copy de 100 GB na landing (VPS)."""
from pathlib import Path

ROOT = Path("/opt/axecloud")


def patch_landing() -> None:
    p = ROOT / "src/views/Landing.tsx"
    t = p.read_text(encoding="utf-8")
    old1 = (
        "const premiumFeatures = [\n"
        "  '14 módulos reais: painel, filhos, giras, financeiro, galeria e mais',\n"
        "  'WhatsApp oficial Meta, loja do axé, almoxarifado e biblioteca',"
    )
    new1 = (
        "const premiumFeatures = [\n"
        "  '14 módulos reais: painel, filhos, giras, financeiro, galeria e mais',\n"
        "  '100 GB de galeria por terreiro — fotos e vídeos de giras, festas e momentos da casa',\n"
        "  'WhatsApp oficial Meta, loja do axé, almoxarifado e biblioteca',"
    )
    if "100 GB de galeria por terreiro" not in t:
        if old1 not in t:
            raise SystemExit("Landing premiumFeatures block not found")
        t = t.replace(old1, new1, 1)

    old2 = (
        "Tudo incluso, sem taxa por filho de santo. Teste grátis por "
        "{TRIAL_DAYS} dias, depois mensalidade via PIX."
    )
    new2 = (
        "Tudo incluso, sem taxa por filho de santo — com 100 GB de galeria por terreiro. "
        "Teste grátis por {TRIAL_DAYS} dias, depois mensalidade via PIX."
    )
    if old2 in t:
        t = t.replace(old2, new2, 1)
    elif new2 not in t:
        raise SystemExit("Landing price blurb not found")

    p.write_text(t, encoding="utf-8")
    print("Landing.tsx OK")


def patch_matriz() -> None:
    p = ROOT / "src/components/landing/MatrizLandingExperience.tsx"
    t = p.read_text(encoding="utf-8")
    old = (
        "description: 'Memória do terreiro: festas, giras e momentos da comunidade organizados.'"
    )
    new = (
        "description: 'Memória do terreiro: até 100 GB de fotos e vídeos por casa, "
        "organizados por festa e gira.'"
    )
    if new not in t:
        if old not in t:
            raise SystemExit("Matriz gallery desc not found")
        t = t.replace(old, new, 1)
        p.write_text(t, encoding="utf-8")
    print("MatrizLandingExperience.tsx OK")


def patch_seo() -> None:
    p = ROOT / "src/constants/seoHome.ts"
    t = p.read_text(encoding="utf-8")
    old = (
        "a: 'Sim. A galeria de fotos organiza álbuns por festa, gira ou tema — "
        "memória da casa em um só lugar, com acesso controlado pela diretoria.'"
    )
    new = (
        "a: 'Sim. A galeria oferece até 100 GB por terreiro para fotos e vídeos — "
        "álbuns por festa, gira ou tema, com acesso controlado pela diretoria.'"
    )
    if new not in t:
        if old not in t:
            raise SystemExit("seoHome FAQ not found")
        t = t.replace(old, new, 1)
        p.write_text(t, encoding="utf-8")
    print("seoHome.ts OK")


if __name__ == "__main__":
    patch_landing()
    patch_matriz()
    patch_seo()
    print("ALL_PATCHED")
